# SupplyED — FULL UI/UX AUDIT REPORT

Audit date: **27 October 2026 (Asia/Karachi)**. Scope: this Next.js web repository, connected local backend, and the supplied school/teacher accounts. **Admin runtime testing excluded at the user's request.** This is an audit, not an implementation or deployment.

## 1. Executive summary

**Not ready for an unrestricted production sign-off.** The core interface renders consistently across the requested widths and both supplied roles can log in. However, the availability calendar is nonfunctional, MAT school navigation can exhaust the signatory-status rate budget and replace the workspace with error screens, mobile Theme controls obscure actions, and several data/error states misrepresent the underlying information. Cold mobile performance is materially worse than desktop localhost timings.

| Result | Count / assessment |
| --- | --- |
| Pages discovered | 32 page surfaces: 30 App Router page patterns + 2 standalone public HTML files; shared 404 is an additional fallback surface |
| Pages actually visited | All 32 discovered page surfaces, plus the shared 404. A visit is NOT a guarantee that every state/action was exercised. |
| Ten-width coverage | 29 of 30 registered patterns + both HTML pages + 404; 61 route/role/state runs including repeats and populated variants = 610 viewport renders. Payout refresh was tested at 390px with session creation blocked. |
| Confirmed distinct issues | 34 |
| P0 | 0 |
| P1 | 2 |
| P2 | 27 |
| P3 | 5 |
| Production build / lint | npm.cmd run build: PASS, including TypeScript. npm.cmd run lint: PASS. |
| Application modifications | None retained. No dependency installation, backend/database changes, deployment or optimizations. Next build regenerated next-env.d.ts; its original content was restored. |
| Mobile | No document-level horizontal overflow in the 610 captured viewport renders; real control occlusion remains (UX-04). No claim of all-state mobile conformance. |
| Functional stability | Login and core reads work; calendar, error handling, data presentation and navigation need fixes. Financial, messaging-send and account-change submissions not executed. |
| Accessibility | Shared controls show several good behaviors; landmark/heading defects remain, and directly served prototypes fail contrast/link-name checks. This is not a WCAG certification. |
| Performance | Teacher cold-mobile LCP 5.708–6.136s in representative local lab runs. Login cold-mobile CLS 0.213. No field INP or real-user metrics. |


Counts include code-proven defects/performance patterns where runtime impact is explicitly unmeasured. They exclude the SUSPECTED opportunities in the performance section. Each repeated instance of a shared root cause is counted once.

### Top ten fixes, in order

1. **UX-02: Signatory rate limits take down the MAT school workspace.** Separate authenticated status-read budgets from sensitive mutations; eliminate duplicate snapshot requests; catch 429 and show an accessible retry countdown while retaining safe navigation. Never bypass compliance checks or rate limits.
2. **UX-01: Availability calendar is a nonfunctional prototype.** Implement real date calculation, selected-month state and authenticated availability persistence; otherwise remove the misleading controls until the feature is ready.
3. **UX-04: Floating Theme button covers mobile form actions.** Move theme settings into the account menu or allocate space that cannot overlap fixed/sticky actions.
4. **UX-09: Profile reviews lose pagination, full-history accuracy and reviewer context.** Expose authoritative rating aggregates and paginated reviews; preserve pagination and map the actual backend booking context.
5. **UX-10: Dashboard treats a failed job-list fetch as an empty account.** Pass query error state into the main job list and metrics; display unavailable values, Retry and retained stale data when appropriate.
6. **PF-02: Stripe and Connect download before payment UI is needed.** Use supported pure loaders and lazy payment/payout boundaries. Assess Stripe fraud-signal requirements with the payment integration before changing loading scope.
7. **PF-01: Both full Inter fonts preload on every App Router page.** Subset to required glyphs and weights after checking content; avoid preloading unused italic face globally. Preserve font-display swap and fallback metrics.
8. **PF-03: All workspace screens share an eagerly imported client shell.** Keep a small shared shell; move page content behind route-level or lazy imports, preserving auth and navigation state.
9. **PF-15: Login shifts substantially during a cold mobile load.** Keep the auth shell geometry stable through hydration and font swap; determine the dominant cause with a performance filmstrip, then reduce font/load gating and match fallback metrics.
10. **UX-03: Profile image storage paths are rendered as broken frontend URLs.** Return authorized display URLs consistently from backend DTOs (as directory/profile endpoints already do); preserve initials fallback and avoid exposing storage keys.

First address UX-02 and UX-01 because they block or falsely promise core work. Next correct controls/data/error handling. Then reduce global font/Stripe/client-shell cost and stabilize login layout; those changes have measured transfer/latency evidence rather than speculative memoization benefits.

## 2. Method, safety and verification limits

- Built the current source with installed **Next.js 16.2.9**, **React/React DOM 19.1.0**, **TanStack Query 5.101.2**, **TypeScript 6.0.3**. Production server ran at 127.0.0.1:3100; the configured backend was local HTTP. The local backend database environment itself was not independently classified as disposable.
- Used an isolated headless Chrome profile through the Chrome DevTools Protocol and existing **axe-core 4.11.3**. Playwright and Lighthouse were not installed; no dependencies were installed. Audit scripts and evidence live under [audit evidence folder](docs/audit-2026-10-27/).
- Widths: **320, 375, 390, 430, 768, 820, 1024, 1280, 1440, 1920 CSS pixels**. Heights were 844px below 768 and 1000px otherwise. Resizing the same loaded page checks reflow; it is not a fresh mobile-device load at every size. Separate 390/820 performance scenarios are described below.
- Browser geometry and broken-image checks ran at each width; axe ran at 320 and 1440. Screenshots were captured at those two widths. Manual visual review used screenshot/contact-sheet inspection, with additional full screenshots for selected populated views and dialogs. **Not every scroll position, hover state or conditional component was visually inspected at all ten widths.**
- Both supplied teacher and school credentials authenticated successfully through the real login UI. Passwords, cookies, bearer tokens and payment secrets were not written to evidence files. Account-specific display data appears in local screenshots/results; keep these audit artifacts private.
- Only read-oriented navigation and safe UI state changes were exercised. No jobs/invitations/bookings were created, accepted, cancelled, closed or deleted; no messages, OTPs, reviews, payments or payout changes were submitted. Opening the cancel dialog was followed by Escape. Payout refresh's POST was explicitly blocked because opening it creates a session.
- A synthetic jobs API 500 response was injected in the browser to test error handling; it was not a real backend outage. Synthetic review objects were used for an isolated source regression. Distinguish these from live findings.
- Admin excluded. Account setup forms behind completed-account redirects, valid signatory tokens, real OTP/2FA, successful signup/reset, uploads, destructive actions, financial iframe flows, cross-user cache leakage, browser back/forward session expiry, actual 200% browser zoom, mobile keyboards, Safari/Firefox and screen-reader speech were **NOT TESTED**. 640 CSS-pixel reflow is a 200%-zoom equivalent layout check, not an actual zoom test.
- Read-only backend source review covered data aggregation, matching, reviews, image DTOs, rate limits and Prisma indexes. No EXPLAIN ANALYZE, database workload profiling, Redis experiment or external production/CDN measurements were run.
- No claim to have identified every possible defect. Source scans, automated rules, sparse test data and finite state coverage cannot establish that.

### Evidence terminology

**CONFIRMED — browser** means reproduced in the stated live/injected state. **CONFIRMED — source** means the exact code path establishes the behavior; it does not imply measured user impact. **SUSPECTED** needs further evidence. **NOT TESTED** is neither pass nor fail. Intentional invalid-token/UUID 404s are not product defects.

## 3. Project discovery and complete route inventory

App Router groups are (public), (auth), and (app). Root layout imports the font and shared CSS; each group creates its own QueryProvider. The PublicHeader additionally creates a nested QueryProvider for its account slot. The server AppRouteShell authenticates and checks profile/compliance state before a broad client RouteShell selects role/page content. Roles are teacher, institution (school/MAT), and admin; status variants include none, pending_review, approved, rejected and suspended.

Protected UI is not solely determined by proxy.ts: /bookings, /security and /institution-profile are absent from its matcher but still authenticate through AppRouteShell. Guest navigation to these was tested and redirected to login. Do not treat the matcher omission itself as an access-control bypass.

Styling: Tailwind 4 utilities and custom layered CSS; Inter; theme variables; Lucide icons; shared atoms/molecules; custom selectors/popovers; Quill dynamically imported by the editor; Stripe embedded forms; Socket.IO for realtime events. 133 TSX component files, 73 query/mutation hook definitions, 202 fetch/api call sites and 55 API route-handler patterns were inventoried. These are file/call-site counts, not distinct rendered component instances or unique backend endpoints.

No checked-in frontend test suite/test script was found beyond lint/build and historical audit documentation. Historical docs describe earlier fixes and fixture tests; they were used as context, **not as evidence that current pages pass**. The backend has its own test files, not run in this frontend audit.

| Route pattern | File | Access / parameters / runtime scope |
| --- | --- | --- |
| /applications | app/(app)/applications/page.tsx | Authenticated; role/status dispatch. Query context supports jobId, applicationId, bookingId, teacherId, institutionId, conversationId, search; invitation detail adds path id. |
| /billing | app/(app)/billing/page.tsx | Authenticated; role/status dispatch. Query context supports jobId, applicationId, bookingId, teacherId, institutionId, conversationId, search; invitation detail adds path id. |
| /bookings | app/(app)/bookings/page.tsx | Authenticated; role/status dispatch. Query context supports jobId, applicationId, bookingId, teacherId, institutionId, conversationId, search; invitation detail adds path id. |
| /calendar | app/(app)/calendar/page.tsx | Authenticated; role/status dispatch. Query context supports jobId, applicationId, bookingId, teacherId, institutionId, conversationId, search; invitation detail adds path id. |
| /dashboard | app/(app)/dashboard/page.tsx | Authenticated; role/status dispatch. Query context supports jobId, applicationId, bookingId, teacherId, institutionId, conversationId, search; invitation detail adds path id. |
| /find-jobs | app/(app)/find-jobs/page.tsx | Authenticated; role/status dispatch. Query context supports jobId, applicationId, bookingId, teacherId, institutionId, conversationId, search; invitation detail adds path id. |
| /find-teachers | app/(app)/find-teachers/page.tsx | Authenticated; role/status dispatch. Query context supports jobId, applicationId, bookingId, teacherId, institutionId, conversationId, search; invitation detail adds path id. |
| /institution-profile | app/(app)/institution-profile/page.tsx | Authenticated; role/status dispatch. Query context supports jobId, applicationId, bookingId, teacherId, institutionId, conversationId, search; invitation detail adds path id. |
| /job-detail | app/(app)/job-detail/page.tsx | Authenticated; role/status dispatch. Query context supports jobId, applicationId, bookingId, teacherId, institutionId, conversationId, search; invitation detail adds path id. |
| /job-invitations | app/(app)/job-invitations/page.tsx | Authenticated; role/status dispatch. Query context supports jobId, applicationId, bookingId, teacherId, institutionId, conversationId, search; invitation detail adds path id. |
| /job-invitations/[id] | app/(app)/job-invitations/[id]/page.tsx | Authenticated; role/status dispatch. Query context supports jobId, applicationId, bookingId, teacherId, institutionId, conversationId, search; invitation detail adds path id. |
| /messaging | app/(app)/messaging/page.tsx | Authenticated; role/status dispatch. Query context supports jobId, applicationId, bookingId, teacherId, institutionId, conversationId, search; invitation detail adds path id. |
| /my-profile | app/(app)/my-profile/page.tsx | Authenticated; role/status dispatch. Query context supports jobId, applicationId, bookingId, teacherId, institutionId, conversationId, search; invitation detail adds path id. |
| /onboarding | app/(app)/onboarding/page.tsx | Authenticated; role/status dispatch. Query context supports jobId, applicationId, bookingId, teacherId, institutionId, conversationId, search; invitation detail adds path id. |
| /payouts/refresh | app/(app)/payouts/refresh/page.tsx | Authenticated; role/status dispatch. Query context supports jobId, applicationId, bookingId, teacherId, institutionId, conversationId, search; invitation detail adds path id. |
| /payouts/return | app/(app)/payouts/return/page.tsx | Authenticated; role/status dispatch. Query context supports jobId, applicationId, bookingId, teacherId, institutionId, conversationId, search; invitation detail adds path id. |
| /post-job | app/(app)/post-job/page.tsx | Authenticated; role/status dispatch. Query context supports jobId, applicationId, bookingId, teacherId, institutionId, conversationId, search; invitation detail adds path id. |
| /security | app/(app)/security/page.tsx | Authenticated; role/status dispatch. Query context supports jobId, applicationId, bookingId, teacherId, institutionId, conversationId, search; invitation detail adds path id. |
| /settings | app/(app)/settings/page.tsx | Authenticated; role/status dispatch. Query context supports jobId, applicationId, bookingId, teacherId, institutionId, conversationId, search; invitation detail adds path id. |
| /teacher-profile | app/(app)/teacher-profile/page.tsx | Authenticated; role/status dispatch. Query context supports jobId, applicationId, bookingId, teacherId, institutionId, conversationId, search; invitation detail adds path id. |
| /forgot-password | app/(auth)/forgot-password/page.tsx | Guest-only; signup type/source/email and login returnTo/error variants exist; initial stage tested |
| /login | app/(auth)/login/page.tsx | Guest-only; signup type/source/email and login returnTo/error variants exist; initial stage tested |
| /signup | app/(auth)/signup/page.tsx | Guest-only; signup type/source/email and login returnTo/error variants exist; initial stage tested |
| /founding-schools | app/(public)/founding-schools/page.tsx | Public; founding pages also consume campaign/source query parameters |
| /founding-teachers | app/(public)/founding-teachers/page.tsx | Public; founding pages also consume campaign/source query parameters |
| /how-it-works | app/(public)/how-it-works/page.tsx | Public; founding pages also consume campaign/source query parameters |
| / | app/(public)/page.tsx | Public; founding pages also consume campaign/source query parameters |
| /signatory-approval/[token] | app/(public)/signatory-approval/[token]/page.tsx | Token bearer workflow; invalid token only |
| /terms | app/(public)/terms/page.tsx | Public; founding pages also consume campaign/source query parameters |
| /post-auth | app/post-auth/page.tsx | Authenticated transition; approved account redirects tested |


Additional document routes: /founding-schools%20(1)%20(1).html and /founding-teachers%20(1).html. Special routes: /robots.txt, /sitemap.xml, /manifest.webmanifest, /theme-bootstrap.js, and unmatched-path 404. Global and per-group loading/error boundaries were inspected; the post-auth route has no custom root error boundary covering its thrown server failure.

## 4. Page coverage matrix and page-by-page findings

**R** = rendered page/state, **D** = redirected (destination recorded), **E** = error screen. All cells refer to automated browser rendering/geometry, not full manual visual verification. Axe at 320/1440 only. Missing-ID choice screens, invalid detail states and role fallback dashboards are explicitly identified by headings/destination. Payout refresh: 390px shell only, POST blocked; all other widths **NOT TESTED**. Onboarding: completed accounts redirected; no fresh-onboarding wizard coverage.

| Role / input URL | Observed state / destination | 320 | 375 | 390 | 430 | 768 | 820 | 1024 | 1280 | 1440 | 1920 | Axe findings at 320 / 1440 | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| public /forgot-password | RENDER: /forgot-password; Recover access securely. | R | R | R | R | R | R | R | R | R | R | 320: landmark-one-main, region / 1440: landmark-one-main, region | browser-public.json |
| public /login | RENDER: /login; Welcome back to SupplyED | R | R | R | R | R | R | R | R | R | R | 320: landmark-one-main, region / 1440: landmark-one-main, region | browser-public.json |
| public /signup | RENDER: /signup; Start with secure access, then complete onboarding. | R | R | R | R | R | R | R | R | R | R | 320: landmark-one-main, region / 1440: landmark-one-main, region | browser-public.json |
| public /founding-schools | RENDER: /founding-schools; Twenty schools will shape how supply cover works.Yours can be one. | R | R | R | R | R | R | R | R | R | R | 320: landmark-complementary-is-top-level / 1440: landmark-complementary-is-top-level | browser-public.json |
| public /founding-teachers | RENDER: /founding-teachers; Work directly with schools.Keep what you earn. | R | R | R | R | R | R | R | R | R | R | 320: landmark-complementary-is-top-level / 1440: landmark-complementary-is-top-level | browser-public.json |
| public /how-it-works | RENDER: /how-it-works; One workflow for cover, compliance, and confidence. | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-public.json |
| public / | RENDER: /; Connecting schools and learners with brilliant teachers. | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-public.json |
| public /signatory-approval/invalid-audit-token | RENDER: /signatory-approval/invalid-audit-token; Review this school's trust membership. | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-public.json |
| public /terms | RENDER: /terms; Terms & Conditions | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-public.json |
| public /audit-invalid-route | RENDER: /audit-invalid-route; Page not found | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-public.json |
| public /founding-schools%20(1)%20(1).html | RENDER: /founding-schools%20(1)%20(1).html; Twenty schools will shapehow supply cover works.Yours can be one. | R | R | R | R | R | R | R | R | R | R | 320: color-contrast, link-name, region / 1440: color-contrast, link-name, region | browser-public.json |
| public /founding-teachers%20(1).html | RENDER: /founding-teachers%20(1).html; Work directly with schools.Keep what you earn. | R | R | R | R | R | R | R | R | R | R | 320: color-contrast, link-name, region / 1440: color-contrast, link-name, region | browser-public.json |
| school /applications | RENDER: /applications; Applications | R | R | R | R | R | R | R | R | R | R | 320: heading-order / 1440: heading-order | browser-school.json |
| school /billing | RENDER: /billing; Billing | R | R | R | R | R | R | R | R | R | R | 320: heading-order / 1440: heading-order | browser-school.json |
| school /bookings | RENDER: /bookings; Bookings | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-school.json |
| school /calendar | RENDER: /calendar; School hiring workspace | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-school.json |
| school /dashboard | RENDER: /dashboard; School hiring workspace | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-school.json |
| school /find-jobs | RENDER: /find-jobs; School hiring workspace | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-school.json |
| school /find-teachers | RENDER: /find-teachers; Find teachers | R | R | R | R | R | R | R | R | R | R | 320: heading-order, landmark-unique / 1440: heading-order, landmark-unique | browser-school.json |
| school /institution-profile | RENDER: /institution-profile; Choose a school | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-school.json |
| school /job-detail | RENDER: /job-detail; (no h1) | R | R | R | R | R | R | R | R | R | R | 320: page-has-heading-one / 1440: page-has-heading-one | browser-school.json |
| school /job-invitations | RENDER: /job-invitations; Sent invitations | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-school.json |
| school /job-invitations/00000000-0000-4000-8000-000000000000 | RENDER: /job-invitations/00000000-0000-4000-8000-000000000000; Job invitation | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-school.json |
| school /messaging | RENDER: /messaging; Messages | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-school.json |
| school /my-profile | RENDER: /my-profile; My Profile | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-school.json |
| school /onboarding | ERROR: /onboarding; We could not load this workspace. | E | E | E | E | E | E | E | E | E | E | 320: none in automated rules / 1440: none in automated rules | browser-school.json |
| school /payouts/return | ERROR: /dashboard; We could not load this workspace. | E | E | E | E | E | E | E | E | E | E | 320: none in automated rules / 1440: none in automated rules | browser-school.json |
| school /post-job | ERROR: /post-job; We could not load this workspace. | E | E | E | E | E | E | E | E | E | E | 320: none in automated rules / 1440: none in automated rules | browser-school.json |
| school /security | ERROR: /security; We could not load this workspace. | E | E | E | E | E | E | E | E | E | E | 320: none in automated rules / 1440: none in automated rules | browser-school.json |
| school /settings | ERROR: /settings; We could not load this workspace. | E | E | E | E | E | E | E | E | E | E | 320: none in automated rules / 1440: none in automated rules | browser-school.json |
| school /teacher-profile | ERROR: /teacher-profile; We could not load this workspace. | E | E | E | E | E | E | E | E | E | E | 320: none in automated rules / 1440: none in automated rules | browser-school.json |
| school /post-auth | ERROR: /post-auth; This page couldn’t load | E | E | E | E | E | E | E | E | E | E | 320: document-title, html-has-lang, landmark-one-main, region / 1440: document-title, html-has-lang, landmark-one-main, region | browser-school.json |
| teacher /applications | RENDER: /applications; My applications | R | R | R | R | R | R | R | R | R | R | 320: heading-order / 1440: heading-order | browser-teacher.json |
| teacher /billing | RENDER: /billing; Earnings | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-teacher.json |
| teacher /bookings | RENDER: /bookings; Bookings | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-teacher.json |
| teacher /calendar | RENDER: /calendar; Availability calendar | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-teacher.json |
| teacher /dashboard | RENDER: /dashboard; Welcome back, Waleed. | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-teacher.json |
| teacher /find-jobs | RENDER: /find-jobs; Find jobs | R | R | R | R | R | R | R | R | R | R | 320: heading-order / 1440: heading-order | browser-teacher.json |
| teacher /find-teachers | RENDER: /find-teachers; Welcome back, Waleed. | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-teacher.json |
| teacher /institution-profile | RENDER: /institution-profile; Choose a school | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-teacher.json |
| teacher /job-detail | RENDER: /job-detail; (no h1) | R | R | R | R | R | R | R | R | R | R | 320: page-has-heading-one / 1440: page-has-heading-one | browser-teacher.json |
| teacher /job-invitations | RENDER: /job-invitations; Job invitations | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-teacher.json |
| teacher /job-invitations/00000000-0000-4000-8000-000000000000 | RENDER: /job-invitations/00000000-0000-4000-8000-000000000000; Job invitation | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-teacher.json |
| teacher /messaging | RENDER: /messaging; Messages | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-teacher.json |
| teacher /my-profile | RENDER: /my-profile; My Profile | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-teacher.json |
| teacher /onboarding | REDIRECT: /dashboard; Welcome back, Waleed. | D | D | D | D | D | D | D | D | D | D | 320: none in automated rules / 1440: none in automated rules | browser-teacher.json |
| teacher /payouts/return | RENDER: /payouts/return; Your payout setup | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-teacher.json |
| teacher /post-job | RENDER: /post-job; Welcome back, Waleed. | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-teacher.json |
| teacher /security | RENDER: /security; Security | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-teacher.json |
| teacher /settings | RENDER: /settings; Settings | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: landmark-unique | browser-teacher.json |
| teacher /teacher-profile | RENDER: /teacher-profile; Choose a teacher | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-teacher.json |
| teacher /post-auth | REDIRECT: /dashboard; Welcome back, Waleed. | D | D | D | D | D | D | D | D | D | D | 320: none in automated rules / 1440: none in automated rules | browser-teacher.json |
| school-retest /onboarding | REDIRECT: /dashboard; School hiring workspace | D | D | D | D | D | D | D | D | D | D | 320: none in automated rules / 1440: none in automated rules | browser-school-retest.json |
| school-retest /post-job | RENDER: /post-job; Post a new role | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-school-retest.json |
| school-retest /security | RENDER: /security; Security | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-school-retest.json |
| school-retest /settings | RENDER: /settings; Settings | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: landmark-unique | browser-school-retest.json |
| school-retest /teacher-profile | RENDER: /teacher-profile; Choose a teacher | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-school-retest.json |
| school-retest /post-auth | REDIRECT: /dashboard; School hiring workspace | D | D | D | D | D | D | D | D | D | D | 320: none in automated rules / 1440: none in automated rules | browser-school-retest.json |
| teacher-detail /job-invitations/f9cde211-d44b-4ece-b42f-442f25d650c3 | RENDER: /job-invitations/f9cde211-d44b-4ece-b42f-442f25d650c3; Job invitation / physics | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: landmark-unique | browser-teacher-detail.json |
| teacher-detail /job-detail?jobId=58cf53ed-115f-4bc1-a102-0ac6b7b05a6e | RENDER: /job-detail?jobId=58cf53ed-115f-4bc1-a102-0ac6b7b05a6e; physics | R | R | R | R | R | R | R | R | R | R | 320: none in automated rules / 1440: none in automated rules | browser-teacher-detail.json |
| teacher-detail /institution-profile?institutionId=b1d3d5e6-3e76-409a-8a8f-1c1ed11a6225 | RENDER: /institution-profile?institutionId=b1d3d5e6-3e76-409a-8a8f-1c1ed11a6225; School profile / Quentin Kim | R | R | R | R | R | R | R | R | R | R | 320: landmark-main-is-top-level, landmark-no-duplicate-main, landmark-unique / 1440: landmark-main-is-top-level, landmark-no-duplicate-main, landmark-unique | browser-teacher-detail.json |


### Per-page issue map and next checks

| Page | Findings / coverage notes |
| --- | --- |
| /applications | AX-02, PF-01, PF-02, PF-03, PF-04, PF-05, PF-09, PF-10, UX-03 — Initial/available account state covered; conditional transactions remain as specified in interaction coverage. |
| /billing | AX-02, PF-01, PF-02, PF-03, PF-04, PF-05, PF-10, PF-12 — Initial/available account state covered; conditional transactions remain as specified in interaction coverage. |
| /bookings | PF-01, PF-02, PF-03, PF-04, PF-05, PF-10, UX-03, UX-04, UX-06 — Initial/available account state covered; conditional transactions remain as specified in interaction coverage. |
| /calendar | PF-01, PF-02, PF-03, PF-04, PF-05, PF-10, UX-01, UX-07 — Initial/available account state covered; conditional transactions remain as specified in interaction coverage. |
| /dashboard | PF-01, PF-02, PF-03, PF-04, PF-05, PF-06, PF-08, PF-10, PF-14, UX-02, UX-03, UX-10 — Initial/available account state covered; conditional transactions remain as specified in interaction coverage. |
| /find-jobs | AX-02, PF-01, PF-02, PF-03, PF-04, PF-05, PF-10, PF-11, UX-07, UX-08 — Initial/available account state covered; conditional transactions remain as specified in interaction coverage. |
| /find-teachers | AX-02, AX-03, PF-01, PF-02, PF-03, PF-04, PF-05, PF-10, UX-07 — Initial/available account state covered; conditional transactions remain as specified in interaction coverage. |
| /institution-profile | AX-05, PF-01, PF-02, PF-03, PF-04, PF-05, PF-10, UX-09 — Missing ID plus populated school profile covered at ten widths. |
| /job-detail | AX-02, PF-01, PF-02, PF-03, PF-04, PF-05, PF-10, UX-06 — Missing ID, teacher invitation-linked job and school-owned job inspected. |
| /job-invitations | PF-01, PF-02, PF-03, PF-04, PF-05, PF-10, UX-03 — Initial/available account state covered; conditional transactions remain as specified in interaction coverage. |
| /job-invitations/[id] | PF-01, PF-02, PF-03, PF-04, PF-05, PF-10 — Invalid UUID and real accepted invitation covered; response submission not executed. |
| /messaging | PF-01, PF-02, PF-03, PF-04, PF-05, PF-09, PF-10, UX-03, UX-06 — Initial/available account state covered; conditional transactions remain as specified in interaction coverage. |
| /my-profile | PF-01, PF-02, PF-03, PF-04, PF-05, PF-07, PF-10 — Initial/available account state covered; conditional transactions remain as specified in interaction coverage. |
| /onboarding | PF-01, PF-02, PF-03, PF-04, PF-05, PF-10, UX-02 — Setup stages NOT TESTED: approved accounts redirect. |
| /payouts/refresh | PF-01, PF-02, PF-03, PF-04, PF-05, PF-10 — 390px shell only; creating a payout session was blocked. |
| /payouts/return | PF-01, PF-02, PF-03, PF-04, PF-05, PF-10, UX-06 — Initial/available account state covered; conditional transactions remain as specified in interaction coverage. |
| /post-job | PF-01, PF-02, PF-03, PF-04, PF-05, PF-10, UX-02, UX-07 — Initial/available account state covered; conditional transactions remain as specified in interaction coverage. |
| /security | PF-01, PF-02, PF-03, PF-04, PF-05, PF-10, UX-02 — Initial/available account state covered; conditional transactions remain as specified in interaction coverage. |
| /settings | AX-03, PF-01, PF-02, PF-03, PF-04, PF-05, PF-10, UX-02, UX-04, UX-14 — Initial/available account state covered; conditional transactions remain as specified in interaction coverage. |
| /teacher-profile | PF-01, PF-02, PF-03, PF-04, PF-05, PF-10, UX-09 — Missing ID covered at ten widths; populated school-side profile inspected separately. |
| /forgot-password | AX-01, PF-01, PF-04 — Initial/available account state covered; conditional transactions remain as specified in interaction coverage. |
| /login | AX-01, PF-01, PF-04, PF-15, UX-05 — Initial/available account state covered; conditional transactions remain as specified in interaction coverage. |
| /signup | AX-01, PF-01, PF-04 — Initial/available account state covered; conditional transactions remain as specified in interaction coverage. |
| /founding-schools | AX-04, PF-01, PF-04, UX-11 — Initial/available account state covered; conditional transactions remain as specified in interaction coverage. |
| /founding-teachers | AX-04, PF-01, PF-04, UX-11 — Initial/available account state covered; conditional transactions remain as specified in interaction coverage. |
| /how-it-works | PF-01, PF-04, UX-13 — Initial/available account state covered; conditional transactions remain as specified in interaction coverage. |
| / | PF-01, PF-04, UX-11 — Initial/available account state covered; conditional transactions remain as specified in interaction coverage. |
| /signatory-approval/[token] | PF-01, PF-04 — Invalid token only; approval/decline requires a valid test token. |
| /terms | PF-01, PF-04, UX-14 — Initial/available account state covered; conditional transactions remain as specified in interaction coverage. |
| /post-auth | PF-01, PF-04, UX-02 — Approved redirects and rate-limited root failure both observed. |


## 5. Issue summary

P0 = critical blocker; P1 = major functionality/usability; P2 = moderate; P3 = minor/polish. Severity is a triage judgment, not a measured financial-loss estimate.

| Issue ID | Severity | Page | Problem | Recommended fix |
| --- | --- | --- | --- | --- |
| AX-01 | P2 | /login, /signup, /forgot-password | Authentication forms have no main landmark | Use a main landmark around the form content and retain descriptive headings. |
| AX-02 | P3 | /applications, /billing, /find-jobs, /find-teachers, /job-detail | Empty states and cards skip heading levels | Use contextual heading levels for reusable empty states and a descriptive h1 for missing-context pages. |
| AX-03 | P3 | /settings, /find-teachers | Workspace complementary landmarks lack distinct names | Give distinct accessible names to complementary landmarks, or use a non-landmark container for purely structural wrappers. |
| AX-04 | P3 | /founding-schools, /founding-teachers | Founding-page complementary content is nested inside main | Use a section/div when content belongs to the main article; reserve a complementary landmark for a distinct sibling region. |
| AX-05 | P2 | /institution-profile | Populated school profile nests a second main landmark | Keep one main landmark at the app shell and use a section/div for the profile content column. |
| PF-01 | P2 | All App Router pages | Both full Inter fonts preload on every App Router page | Subset to required glyphs and weights after checking content; avoid preloading unused italic face globally. Preserve font-display swap and fallback metrics. |
| PF-02 | P2 | All authenticated workspace pages | Stripe and Connect download before payment UI is needed | Use supported pure loaders and lazy payment/payout boundaries. Assess Stripe fraud-signal requirements with the payment integration before changing loading scope. |
| PF-03 | P2 | All authenticated workspace pages | All workspace screens share an eagerly imported client shell | Keep a small shared shell; move page content behind route-level or lazy imports, preserving auth and navigation state. |
| PF-04 | P3 | All App Router pages | Workspace and editor CSS are globally delivered to marketing pages | Move route-specific CSS to the owning layouts/components, keeping true foundations shared. Check CSS layer ordering and editor styles. |
| PF-05 | P2 | All non-admin workspace routes | Onboarding checks repeat across server render and client mount | Reuse request-scoped auth/profile data and hydrate the client with a minimal snapshot. Parallelize only independent reads; use approval events and a safe revalidation window. Keep authoritative access checks on the server. |
| PF-06 | P2 | /dashboard | Job list fires one applicant-count request per row | Return counts with the authorized job listing or use one batched count endpoint; keep per-job applicant data lazy. |
| PF-07 | P2 | /my-profile | School profile history aggregates entire datasets before paginating | Implement authorized backend history/review queries with server-side filtering, pagination and aggregate counts. |
| PF-08 | P2 | /dashboard | Teacher dashboard downloads every application page to calculate totals | Provide compact authorized summary counts and bounded upcoming/pending previews; preserve full records in paginated workspaces. |
| PF-09 | P2 | /applications, /messaging | Invitation summaries repeatedly load all invitation history | Fetch bounded per-job/thread summaries or pending records, with cursor paging for history; apply socket updates to affected keys. |
| PF-10 | P2 | All query-driven pages | Query cancellation never reaches fetchJson network requests | Accept and combine the query AbortSignal with timeout; pass it through all fetchJson hooks and multi-page loops. Preserve abort semantics. |
| PF-11 | P2 | /find-jobs | Job discovery fetches inactive feed and refetches as text changes | Enable only the active feed (optionally prefetch deliberately); debounce text/search-like values or offer Apply; keep numeric drafts local until committed. |
| PF-12 | P2 | /billing, /bookings invoice modal | Completed invoices continue polling indefinitely | Poll only unsettled/payment-in-flight states, refresh on relevant events/focus, and use a bounded reconciliation interval for mutable post-payment events. |
| PF-13 | P2 | Most authenticated API routes | Authenticated JSON responses lack explicit private/no-store HTTP headers | Declare private, no-store for sensitive responses and signed previews/tickets; retain in-memory user-scoped Query caching where appropriate. Verify deployment/CDN policy separately. |
| PF-14 | P2 | /dashboard | School dashboard has a measurable initial layout shift | Use stable skeleton/empty-state dimensions and reserved metric/card regions after identifying the largest shifting nodes. |
| PF-15 | P2 | /login | Login shifts substantially during a cold mobile load | Keep the auth shell geometry stable through hydration and font swap; determine the dominant cause with a performance filmstrip, then reduce font/load gating and match fallback metrics. |
| UX-01 | P1 | /calendar | Availability calendar is a nonfunctional prototype | Implement real date calculation, selected-month state and authenticated availability persistence; otherwise remove the misleading controls until the feature is ready. |
| UX-02 | P1 | /dashboard, /post-job, /settings, /security, /onboarding, /post-auth | Signatory rate limits take down the MAT school workspace | Separate authenticated status-read budgets from sensitive mutations; eliminate duplicate snapshot requests; catch 429 and show an accessible retry countdown while retaining safe navigation. Never bypass compliance checks or rate limits. |
| UX-03 | P2 | /bookings, /messaging, /job-invitations, /applications, /dashboard | Profile image storage paths are rendered as broken frontend URLs | Return authorized display URLs consistently from backend DTOs (as directory/profile endpoints already do); preserve initials fallback and avoid exposing storage keys. |
| UX-04 | P2 | /bookings, /settings | Floating Theme button covers mobile form actions | Move theme settings into the account menu or allocate space that cannot overlap fixed/sticky actions. |
| UX-05 | P2 | /login | Remember this device has no effect | Implement an explicit session-lifetime policy or remove the control; verify cookie/session lifetime behavior in isolated accounts. |
| UX-06 | P2 | /job-detail, /bookings, /messaging, /payouts/return | Most authenticated deep links are lost at login | Use a validated allowlist of local application return paths including safe query parameters; reject external/open-redirect targets. |
| UX-07 | P2 | /calendar, /find-jobs, /find-teachers, /post-job | Unsupported role routes silently render the dashboard under the wrong URL | Define role-route eligibility explicitly and redirect to the real dashboard URL or show an intentional unavailable/403 state. |
| UX-08 | P2 | /find-jobs | Map view is decorative and can disagree with job results | Implement a real accessible location view using the active result set, or label/remove the illustration. |
| UX-09 | P2 | /teacher-profile, /institution-profile | Profile reviews lose pagination, full-history accuracy and reviewer context | Expose authoritative rating aggregates and paginated reviews; preserve pagination and map the actual backend booking context. |
| UX-10 | P2 | /dashboard | Dashboard treats a failed job-list fetch as an empty account | Pass query error state into the main job list and metrics; display unavailable values, Retry and retained stale data when appropriate. |
| UX-11 | P3 | /, /founding-schools, /founding-teachers | Public mobile navigation remains open after Escape or a same-page link | Close the disclosure on Escape and navigation, preserve focus on dismissal and move focus appropriately for anchors. |
| UX-12 | P2 | /founding-schools%20(1)%20(1).html, /founding-teachers%20(1).html | Two unlinked public HTML prototypes expose broken and inconsistent experiences | Remove them from deployable public assets or replace them with canonical redirects; retain references outside the public directory if needed. |
| UX-13 | P2 | /how-it-works | How-it-works still publishes prototype statistics | Replace prototype metrics with supported content or remove them before launch. |
| UX-14 | P2 | /terms, /settings | Terms promise an account-close action that Settings does not offer | Align the help/terms navigation with the actual supported closure request path, or implement the promised flow after separate approval. |


## 6. Detailed responsiveness, visual, functional, accessibility and UX findings

### AX-01 — Authentication forms have no main landmark

| Field | Finding |
| --- | --- |
| Severity / verification | P2 / CONFIRMED — axe best-practice + source |
| Route / component | /login, /signup, /forgot-password / Authentication shells |
| Exact source | components/organisms/LoginPage.tsx:71,118; components/organisms/SignupAccessPage.tsx; components/organisms/ForgotPasswordRouteClient.tsx |
| Viewport / device | All unless stated |
| Steps to reproduce | Run axe on each initial auth screen. |
| Expected | Assistive technology can locate the primary form through landmarks. |
| Actual / description | axe reports landmark-one-main and region at both 320 and 1440. Form content lives in unnamed section/div containers. |
| Root cause | Visual auth-main classes do not provide a main semantic element. Best-practice finding; not by itself a WCAG AA conformance verdict. |
| Recommended solution | Use a main landmark around the form content and retain descriptive headings. |
| Evidence | browser-public.json |

### AX-02 — Empty states and cards skip heading levels

| Field | Finding |
| --- | --- |
| Severity / verification | P3 / CONFIRMED — axe + source |
| Route / component | /applications, /billing, /find-jobs, /find-teachers, /job-detail / Workspace headings |
| Exact source | components/organisms/WorkspacePanels.tsx; components/molecules/TeacherBookingDates.tsx; components/organisms/JobDetailPage.tsx |
| Viewport / device | All unless stated |
| Steps to reproduce | Run axe at 320/1440 on these states. |
| Expected | The advertised action or information is accurate, accessible, and recoverable. |
| Actual / description | Initial empty states jump h1 to h3; /job-detail without an ID has no h1. Teacher directory repeated booking cards introduce h3 without the surrounding h2 hierarchy. |
| Root cause | Reusable fixed h3 headings are not contextualized. Primarily best-practice rules, not automatic AA failure. |
| Recommended solution | Use contextual heading levels for reusable empty states and a descriptive h1 for missing-context pages. |
| Evidence | browser-school.json; browser-teacher.json |

### AX-03 — Workspace complementary landmarks lack distinct names

| Field | Finding |
| --- | --- |
| Severity / verification | P3 / CONFIRMED — axe |
| Route / component | /settings, /find-teachers / Workspace sidebar and page sidebars |
| Exact source | components/organisms/AppChrome.tsx:93; components/organisms/SettingsPage.tsx; components/organisms/FindTeachersPage.tsx |
| Viewport / device | Desktop; directory also flagged at 320 |
| Steps to reproduce | Run axe at 1440 on Settings; inspect landmark list. |
| Expected | The advertised action or information is accurate, accessible, and recoverable. |
| Actual / description | Desktop Settings and teacher-directory layouts include multiple complementary landmarks; the workspace aside is unnamed. |
| Root cause | Workspace aside competes with page-specific asides without a unique accessible name. |
| Recommended solution | Give distinct accessible names to complementary landmarks, or use a non-landmark container for purely structural wrappers. |
| Evidence | browser-school-retest.json; browser-teacher.json; browser-school.json |

### AX-04 — Founding-page complementary content is nested inside main

| Field | Finding |
| --- | --- |
| Severity / verification | P3 / CONFIRMED — axe best-practice |
| Route / component | /founding-schools, /founding-teachers / FoundingInterestPage |
| Exact source | components/organisms/FoundingInterestPage.tsx |
| Viewport / device | All unless stated |
| Steps to reproduce | Run axe at 320 or 1440. |
| Expected | The advertised action or information is accurate, accessible, and recoverable. |
| Actual / description | axe flags landmark-complementary-is-top-level on founding pages. |
| Root cause | Page aside placement is inconsistent with the intended landmark structure. |
| Recommended solution | Use a section/div when content belongs to the main article; reserve a complementary landmark for a distinct sibling region. |
| Evidence | browser-public.json |

### AX-05 — Populated school profile nests a second main landmark

| Field | Finding |
| --- | --- |
| Severity / verification | P2 / CONFIRMED — populated browser + axe |
| Route / component | /institution-profile / InstitutionProfilePage |
| Exact source | components/organisms/InstitutionProfilePage.tsx:66; components/organisms/AppChrome.tsx:166 |
| Viewport / device | All unless stated |
| Steps to reproduce | Open a real school profile via an accepted invitation; inspect landmarks. |
| Expected | One unambiguous main landmark per document. |
| Actual / description | The profile uses a main element inside the workspace main. axe reports landmark-main-is-top-level, landmark-no-duplicate-main and landmark-unique at 320 and 1440. |
| Root cause | Established by the cited source and evidence. |
| Recommended solution | Keep one main landmark at the app shell and use a section/div for the profile content column. |
| Evidence | browser-teacher-detail.json /institution-profile |

### UX-01 — Availability calendar is a nonfunctional prototype

| Field | Finding |
| --- | --- |
| Severity / verification | P1 / CONFIRMED — browser + source |
| Route / component | /calendar / CalendarPage |
| Exact source | components/organisms/CalendarPage.tsx:5 |
| Viewport / device | All unless stated |
| Steps to reproduce | Sign in as teacher; open Calendar; activate Next, Save changes and an availability toggle. |
| Expected | Valid dates for the selected month; editable availability with persisted success/error feedback. |
| Actual / description | The month remains March 2026; March 32 and March 33 are rendered. Next, Prev, Save changes and availability toggles do not change or persist anything. |
| Root cause | Hardcoded 35 cells and month; buttons have no handlers and Toggle callbacks are empty. |
| Recommended solution | Implement real date calculation, selected-month state and authenticated availability persistence; otherwise remove the misleading controls until the feature is ready. |
| Evidence | interactions-teacher.json; screenshots/teacher-_calendar-320.png |

### UX-02 — Signatory rate limits take down the MAT school workspace

| Field | Finding |
| --- | --- |
| Severity / verification | P1 / CONFIRMED — live 429 + server log + recovery |
| Route / component | /dashboard, /post-job, /settings, /security, /onboarding, /post-auth / AppRouteShell / getOnboardingProfileSnapshot / RateLimitGuard |
| Exact source | features/onboarding/actions.ts:503; components/route-shell.tsx:36; ../supplyed-backend/src/common/guards/rate-limit.guard.ts:37 |
| Viewport / device | All unless stated |
| Steps to reproduce | Use a MAT school account; repeatedly navigate/refresh workspace pages within the 15-minute security bucket. Do not deliberately load-test production. |
| Expected | A throttled ancillary read gives a clear retry state without an opaque workspace failure. |
| Actual / description | After repeated audit navigation, /institutions/me/signatory-approval returned 429 with retryAfter 193s. Workspace routes showed a generic error; /post-auth fell to Next’s unbranded root failure page. Retesting after cooldown restored the pages. Later repeated navigation reproduced the limit. |
| Root cause | Every route snapshot checks signatory status; client snapshot refetch repeats it. Backend GET limit is 60/900s by operation/IP and bearer, plus shared IP security budget 150/900s. Raw errors escape the server shell. |
| Recommended solution | Separate authenticated status-read budgets from sensitive mutations; eliminate duplicate snapshot requests; catch 429 and show an accessible retry countdown while retaining safe navigation. Never bypass compliance checks or rate limits. |
| Evidence | browser-school.json (onboarding onward); browser-school-retest.json; performance-school.json (error screens only); screenshots/school-_post_auth-320.png |

### UX-03 — Profile image storage paths are rendered as broken frontend URLs

| Field | Finding |
| --- | --- |
| Severity / verification | P2 / CONFIRMED — browser + source |
| Route / component | /bookings, /messaging, /job-invitations, /applications, /dashboard / Avatar / participant normalization |
| Exact source | features/bookings/schemas.ts:113; features/conversations/schemas.ts:68; components/atoms/Avatar.tsx:44; ../supplyed-backend/src/modules/bookings/dto/booking-response.dto.ts:194 |
| Viewport / device | All unless stated |
| Steps to reproduce | Open populated bookings, invitations or messaging; inspect image requests. |
| Expected | A valid authorized image URL or an explicit empty image, without repeated 404 requests. |
| Actual / description | Stored profile-images/<user>/<asset> strings become requests to the frontend origin and return 404. Initials hide the broken image icon, but photos never display. This occurs in multiple school and teacher views. |
| Root cause | Booking/invitation DTOs and conversation service pass entity.imageUrl directly; frontend uses it without resolving it. |
| Recommended solution | Return authorized display URLs consistently from backend DTOs (as directory/profile endpoints already do); preserve initials fallback and avoid exposing storage keys. |
| Evidence | browser-school.json and browser-teacher.json responseErrors; network URLs /profile-images/... |

### UX-04 — Floating Theme button covers mobile form actions

| Field | Finding |
| --- | --- |
| Severity / verification | P2 / CONFIRMED — geometry + hit testing |
| Route / component | /bookings, /settings / TweaksPanel |
| Exact source | components/organisms/TweaksPanel.tsx:29 |
| Viewport / device | 320×844 |
| Steps to reproduce | At 320×844 open Bookings at initial scroll; inspect Apply filters. Open Settings and inspect the sticky action bar. |
| Expected | The advertised action or information is accurate, accessible, and recoverable. |
| Actual / description | At 320×844, Theme covers the lower part of Apply filters (y765–803; Theme y782–824) and the Settings Cancel action. Hit testing returns Theme over the overlapped area. |
| Root cause | Fixed bottom/right placement at z70 has no relationship to form or sticky-footer geometry. |
| Recommended solution | Move theme settings into the account menu or allocate space that cannot overlap fixed/sticky actions. |
| Evidence | edge-checks.json; screenshots/school-_bookings-320.png; screenshots/teacher-_settings-320.png |

### UX-05 — Remember this device has no effect

| Field | Finding |
| --- | --- |
| Severity / verification | P2 / CONFIRMED — source |
| Route / component | /login / LoginPage |
| Exact source | components/organisms/LoginPage.tsx:40,63,165 |
| Viewport / device | All unless stated |
| Steps to reproduce | Compare checked/unchecked login call path in source; both call onLogin(email.trim(), password). |
| Expected | The checkbox affects session persistence as its label promises. |
| Actual / description | Checkbox state is maintained locally, but onLogin receives only email and password. No session or cookie setting consumes remember. |
| Root cause | The remember value is never passed to authentication. |
| Recommended solution | Implement an explicit session-lifetime policy or remove the control; verify cookie/session lifetime behavior in isolated accounts. |
| Evidence | inventory.json and cited source |

### UX-06 — Most authenticated deep links are lost at login

| Field | Finding |
| --- | --- |
| Severity / verification | P2 / CONFIRMED — source + guest browser redirect |
| Route / component | /job-detail, /bookings, /messaging, /payouts/return / redirectTo / invitationReturnPath |
| Exact source | proxy.ts:28; lib/invitation-links.ts:2; components/organisms/LoginRouteClient.tsx:72 |
| Viewport / device | All unless stated |
| Steps to reproduce | Open /job-detail?jobId=<valid-id> signed out; inspect redirect; sign in. Contrast with an invitation URL. |
| Expected | Successful sign-in returns to the intended authorized page. |
| Actual / description | Only invitation paths are preserved. A guest job-detail query redirects to /login without its destination. Payout callbackUrl is also ignored by the login client. |
| Root cause | Return-path utility accepts only /job-invitations and UUID detail paths. |
| Recommended solution | Use a validated allowlist of local application return paths including safe query parameters; reject external/open-redirect targets. |
| Evidence | interactions-public.json; proxy.ts; LoginRouteClient.tsx |

### UX-07 — Unsupported role routes silently render the dashboard under the wrong URL

| Field | Finding |
| --- | --- |
| Severity / verification | P2 / CONFIRMED — browser + source |
| Route / component | /calendar, /find-jobs, /find-teachers, /post-job / RouteShell role dispatch |
| Exact source | components/organisms/RouteShell.tsx:160 |
| Viewport / device | All unless stated |
| Steps to reproduce | Deep-link to one of these routes with the opposite role. |
| Expected | URL, active navigation and page content agree; role restrictions are clear. |
| Actual / description | School /calendar and /find-jobs show School hiring workspace. Teacher /find-teachers and /post-job show the teacher dashboard while preserving the requested URL. |
| Root cause | Each role branch falls back to its dashboard component without redirecting. |
| Recommended solution | Define role-route eligibility explicitly and redirect to the real dashboard URL or show an intentional unavailable/403 state. |
| Evidence | browser-school.json; browser-teacher.json |

### UX-08 — Map view is decorative and can disagree with job results

| Field | Finding |
| --- | --- |
| Severity / verification | P2 / CONFIRMED — source; no populated live pins available |
| Route / component | /find-jobs / FindJobsPage map |
| Exact source | components/organisms/FindJobsPage.tsx:111 |
| Viewport / device | All unless stated |
| Steps to reproduce | Inspect map branch; use data in both result feeds to compare recommendations and markers. Current teacher dataset has no open jobs, so populated visual behavior was not tested. |
| Expected | A map reflects actual job locations and the selected feed. |
| Actual / description | The map is a CSS background with four hardcoded percentage coordinates; markers use jobs from All jobs even while For you is active. Markers are noninteractive divs. |
| Root cause | Hardcoded positions and wrong data source, without geospatial logic. |
| Recommended solution | Implement a real accessible location view using the active result set, or label/remove the illustration. |
| Evidence | FindJobsPage.tsx; browser-teacher.json /find-jobs |

### UX-09 — Profile reviews lose pagination, full-history accuracy and reviewer context

| Field | Finding |
| --- | --- |
| Severity / verification | P2 / CONFIRMED — source + isolated synthetic regression |
| Route / component | /teacher-profile, /institution-profile / normalizeProfileReviews / ProfileReviewsPanel |
| Exact source | features/reviews/queries.ts:20; features/reviews/schemas.ts:40,79,95; components/organisms/ProfileReviewsPanel.tsx:21; ../supplyed-backend/src/modules/reviews/reviews.service.ts:129 |
| Viewport / device | All unless stated |
| Steps to reproduce | Run source-regressions.mjs; test a profile with >20 reviews of differing ratings and inspect names/job labels. |
| Expected | All reviews are reachable; aggregate rating and total describe the same population. Dataset >20 was synthetic, not a live production fixture. |
| Actual / description | Backend defaults to 20 reviews/page and returns nested booking context. Frontend requests only the first page, discards pagination, calculates a page-only mean while displaying the full total, and drops nested reviewer/job names. |
| Root cause | Response contract mismatch and first-page-only normalization. |
| Recommended solution | Expose authoritative rating aggregates and paginated reviews; preserve pagination and map the actual backend booking context. |
| Evidence | source-regressions.json; backend list-reviews-query.dto.ts; populated profile screenshot |

### UX-10 — Dashboard treats a failed job-list fetch as an empty account

| Field | Finding |
| --- | --- |
| Severity / verification | P2 / CONFIRMED — browser with injected 500 |
| Route / component | /dashboard / InstitutionDashboard / JobManagementList |
| Exact source | components/organisms/InstitutionDashboard.tsx:15,63,78; components/organisms/JobManagementList.tsx:93 |
| Viewport / device | All unless stated |
| Steps to reproduce | Use the read-only edge-checks.mjs interception; return 500 for jobs/mine and open school dashboard. |
| Expected | Failure is distinguishable from a genuine empty account. |
| Actual / description | When /api/jobs/mine returns 500, primary metrics display zero and Job posts says No roles found/Create a role. A separate rail reports an error, so the main summary is contradictory. |
| Root cause | data?.jobs ?? [] and counts ?? 0 are rendered without a jobsQuery.isError branch. |
| Recommended solution | Pass query error state into the main job list and metrics; display unavailable values, Retry and retained stale data when appropriate. |
| Evidence | edge-checks.json; screenshots/school-dashboard-injected-500.png |

### UX-11 — Public mobile navigation remains open after Escape or a same-page link

| Field | Finding |
| --- | --- |
| Severity / verification | P3 / CONFIRMED — browser + source |
| Route / component | /, /founding-schools, /founding-teachers / PublicHeader mobile details |
| Exact source | components/organisms/PublicHeader.tsx:106 |
| Viewport / device | 320×568 |
| Steps to reproduce | At 320px open Navigation menu; press Escape; choose FAQ on the home page. |
| Expected | Overlay navigation dismisses predictably. |
| Actual / description | Native details navigation has no Escape handler; FAQ links do not close details. Only the waitlist handler explicitly removes open. |
| Root cause | Ordinary nav links have no close behavior; details is left open. |
| Recommended solution | Close the disclosure on Escape and navigation, preserve focus on dismissal and move focus appropriately for anchors. |
| Evidence | interactions-public.json |

### UX-12 — Two unlinked public HTML prototypes expose broken and inconsistent experiences

| Field | Finding |
| --- | --- |
| Severity / verification | P2 / CONFIRMED — browser + axe + source |
| Route / component | /founding-schools%20(1)%20(1).html, /founding-teachers%20(1).html / Standalone prototype documents |
| Exact source | public/founding-schools (1) (1).html; public/founding-teachers (1).html |
| Viewport / device | All unless stated |
| Steps to reproduce | Open both encoded URLs directly; run axe and inspect footer links and console. |
| Expected | Only maintained pages are publicly served. |
| Actual / description | Direct URLs return full prototype pages with placeholder company identifiers, # privacy links, an empty logo link and multiple contrast failures. Inline image-error handlers throw a TypeError when they attempt to update a missing element. These bypass the main shared layout/design system. |
| Root cause | Reference HTML is stored in Next public/ and is therefore directly served. |
| Recommended solution | Remove them from deployable public assets or replace them with canonical redirects; retain references outside the public directory if needed. |
| Evidence | browser-public.json; screenshots/public-_founding_schools_20_1_20_1_html-320.png |

### UX-13 — How-it-works still publishes prototype statistics

| Field | Finding |
| --- | --- |
| Severity / verification | P2 / CONFIRMED — browser + source |
| Route / component | /how-it-works / HowItWorksPage |
| Exact source | app/(public)/how-it-works/page.tsx:9,40 |
| Viewport / device | All unless stated |
| Steps to reproduce | Open /how-it-works and inspect metrics/description. |
| Expected | Public product copy describes the actual service and substantiated metrics. |
| Actual / description | Metadata calls the page a dummy overview; visible metrics include 94% dummy same-day fill rate and 8.4k example verified teachers. |
| Root cause | Established by the cited source and evidence. |
| Recommended solution | Replace prototype metrics with supported content or remove them before launch. |
| Evidence | screenshots/public-_how_it_works-320.png; source |

### UX-14 — Terms promise an account-close action that Settings does not offer

| Field | Finding |
| --- | --- |
| Severity / verification | P2 / CONFIRMED — source + settings browser inspection |
| Route / component | /terms, /settings / TermsPage / SettingsPage |
| Exact source | app/(public)/terms/page.tsx:122; components/organisms/SettingsPage.tsx |
| Viewport / device | All unless stated |
| Steps to reproduce | Read Ending your account in Terms; open Settings for teacher and school. |
| Expected | Users can find the documented action. |
| Actual / description | Terms say an account can be closed from Settings, but the teacher/school settings UI and action inventory provide no account-close control. |
| Root cause | Copy and implemented account controls are out of sync. This is a UX finding, not legal compliance advice. |
| Recommended solution | Align the help/terms navigation with the actual supported closure request path, or implement the promised flow after separate approval. |
| Evidence | inventory.json and cited source |

## 7. Interaction, form, modal and edge-case coverage

| Journey / state | Result and limits |
| --- | --- |
| Teacher and school login | Successful real email/password login. Empty-field validation also tested. Checkbox persistence defect is source-confirmed; OAuth and OTP/2FA were not submitted. |
| Public registration/recovery/founding forms | Empty submissions expose invalid fields/errors. Signup success, resend, password reset delivery and waitlist success were not sent. |
| Public header / FAQ anchor | Menu opens; Escape and same-page link leave details open (UX-11). Theme palette closes on Escape and restores trigger focus. |
| Teacher mobile workspace nav | Open → first nav control focused; Escape closes and returns focus. 390×390 landscape checked. |
| School teacher directory | Mobile filters open; no-match search exercised. Filter reset was not explicitly activated despite the test-name label. Sorting options and all combinations not exhausted. |
| Job posting | First wizard Continue advanced to details. This is not evidence of full required-field validation or draft/publish success. No draft/publish submitted. |
| Teacher job discovery | For you/All jobs toggles and 101 minimum-score validation checked. No open jobs in supplied teacher feed; invitation-linked existing job detail checked separately. |
| Calendar | Next/Save/toggle do nothing; invalid day numbers reproduced (UX-01). |
| Booking cancellation modal | Open at 320×500; dialog fits viewport, body scroll locks, Shift+Tab remains inside, Escape closes, trigger focus restores. Cancellation NOT submitted. |
| Invoice/payment/refund modals | Source reviewed; payment/session creation/refund/resend/void/instant-payout actions NOT executed. No payment certification. |
| Proposal/document/attachment overlays | Source scan of Modal/preview/editor consumers; actual uploads, large document rendering and all nested overlays NOT TESTED. |
| Populated dynamic detail | Real accepted invitation, linked job and institution profile checked at ten widths; populated teacher profile and school job inspected separately. |
| API failure | Injected browser 500 at jobs/mine reproduced misleading zeros/empty state. Live signatory 429 reproduced full workspace failure. Invalid token/UUID produced expected unavailable states. |
| Offline / 401 / 403 / arbitrary 500 routes | Only selected failures above tested. Full offline journey, forced 401/403 across every endpoint, refresh while pending and account expiry NOT TESTED. |
| Missing images | Live profile-image 404s observed with initials fallback. Broken-image DOM scan does not catch failed Image preloads, so network evidence was used. |
| Large datasets / long text / null data | Source inspection and isolated review-normalization regression. No large production datasets created; worst-case browser responsiveness NOT TESTED. |
| Zoom / orientation / keyboard | 640×450 reflow equivalent and 820×390 landscape directory checked without overflow. Actual browser zoom, OS mobile keyboard and screen-reader speech NOT TESTED. |
| Duplicate submissions / destructive actions | Pending/disabled guards inspected in shared Button and mutation consumers. Rapid live writes were not performed; transactions require a disposable test environment. |
| Back/forward / refresh / links | Direct navigation and cold/warm full reloads covered. Invitation return path retained; general return path lost. Browser back/forward state retention and every outbound link NOT TESTED. |


Evidence: [interactions-public.json](docs/audit-2026-10-27/interactions-public.json), [interactions-teacher.json](docs/audit-2026-10-27/interactions-teacher.json), [interactions-school.json](docs/audit-2026-10-27/interactions-school.json), [edge-checks.json](docs/audit-2026-10-27/edge-checks.json), [source-regressions.json](docs/audit-2026-10-27/source-regressions.json). Read the complete details, not just the test names. Early teacher control actions were DOM-triggered; trusted keyboard events were used. Final school/public pointer checks use CDP mouse events.

## 8. Browser console and frontend quality

- Confirmed unexpected image 404s across both workspaces (UX-03).
- Prototype HTML image error handlers throw **TypeError: Cannot set properties of null (setting 'innerHTML')** at school HTML lines 428/683 and teacher HTML lines 460/725. Their logo/image resources also 404. These are grouped in UX-12.
- Invalid signatory token, invalid invitation UUID and deliberate unknown page generate expected 404 errors, not separate defects.
- No hydration mismatch was identified in captured later Runtime console/error and screenshot evidence. Initial public/school sweep captured Runtime exceptions and Log errors but did not subscribe to consoleAPICalled; later teacher/retest sweeps did. Do not interpret zero early errors as proof of zero console warnings.
- Server emitted a Stripe Connect SSR-loading warning, consistent with PF-02, and ApiError 429 stack traces for UX-02. Build emitted a MODULE_TYPELESS_PACKAGE_JSON warning for tailwind.config.ts. Build and lint still passed.
- Error boundary copy is implementation-oriented ('workspace route could not render', 'global app shell') and obscures the actionable rate-limit reason. Correct within UX-02.

## 9. DEEP PERFORMANCE AND CACHING AUDIT

### A. Executive performance summary

Existing TanStack Query already supplies request sharing, in-memory caching and invalidation. **Do not add SWR or another query library by default.** The most compelling opportunities are excessive initial transfer, unnecessary payment initialization, duplicated compliance snapshots, per-row counts, and whole-history aggregation. React.memo alone cannot fix these.

Production configuration has no reactCompiler option or compiler Babel plugin, so React Compiler is not enabled in this build. cacheComponents is also not enabled. Root layouts are server components with client islands; marketing content is largely server-rendered. Workspace pages are server-authenticated then hydrated into a broad client shell. Quill already uses import('quill'); do not report it as fully eager without tracing the actual route.

### Measurement protocol and boundaries

- Desktop base runs: 1440×1000, CPU/network unthrottled, cold browser cache then warm full reload; one observation per condition. Cookies retained within a role. CDP network count/encoded bytes include resources seen in the observation window, sometimes prefetch and third-party requests. API responses may arrive after loadEventEnd.
- Throttle runs: 390×844, **150ms latency, 200,000 bytes/s down (~1.6Mbps), 93,750 bytes/s up, 4× CPU slowdown**, cold then warm. Tablet: 820×1000, unthrottled cold. Local origin/backend; not a geographic/mobile-device simulation. One sample each, no percentile or field claims.
- Cold means cleared HTTP cache, not cleared auth or backend caches. Warm is HTTP-warm full navigation, not preserved React Query state. Data APIs refetching on a full reload is expected and not by itself a cache defect.
- load = navigation loadEventEnd; TTFB = responseStart; FCP and LCP use browser Performance APIs. Initial desktop CLS is accumulated non-input layout shifts before resizing, a diagnostic; throttled runs use session-window CLS. **Field INP, Lighthouse TBT, React commit duration and navigation-click latency are NOT TESTED.** Longtask events are available in raw evidence; no Lighthouse score or TBT was fabricated.
- **School throttled/tablet performance runs reached rate-limited error screens and are excluded from success-page rankings.** Their raw data remains in performance-school.json to document the blocker. Do not quote their apparently fast LCP as school page performance.
- Only nine route/role combinations received the separate throttle protocol (six successful, three blocked). Other route/mobile cold/warm conditions are **NOT TESTED**; rendering at 390px is not a mobile performance benchmark.

### B. Page-by-page performance matrix

Milliseconds unless noted; KiB = 1024 bytes. This matrix includes redirects and error-state observations so nothing is silently omitted. Cold/warm load and LCP are local lab observations, not guaranteed user experience. Each route's shared/per-page bottlenecks are mapped immediately afterward.

| Role / route | State | Cold load | Warm load | Cold LCP | Cold CLS diagnostic | INP | Cold requests | Cold KiB | Cold JS KiB | FCP / TTFB | Slowest observed cold API |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| public /forgot-password | RENDER | 202 | 55 | 212 | 0.0000 | NOT TESTED | 27 | 1058.9 | 271.1 | 212 / 63 | /api/dropdowns/themeAccent 31ms |
| public /login | RENDER | 197 | 47 | 260 | 0.0000 | NOT TESTED | 27 | 1063.9 | 273.5 | 196 / 121 | /api/dropdowns/themeAccent 11ms |
| public /signup | RENDER | 184 | 85 | 268 | 0.0000 | NOT TESTED | 27 | 1064.6 | 274.3 | 172 / 27 | /api/dropdowns/themeAccent 25ms |
| public /founding-schools | RENDER | 210 | 65 | 224 | 0.0000 | NOT TESTED | 47 | 1114.3 | 287.4 | 224 / 47 | /api/dropdowns/supplyDaysPerTerm 60ms |
| public /founding-teachers | RENDER | 203 | 56 | 216 | 0.0000 | NOT TESTED | 46 | 1112.1 | 287.4 | 216 / 32 | /api/dropdowns/daysPerWeek 106ms |
| public /how-it-works | RENDER | 125 | 48 | 144 | 0.0000 | NOT TESTED | 43 | 1088.7 | 282.7 | 144 / 17 | /api/dropdowns/themeAccent 26ms |
| public / | RENDER | 168 | 36 | 180 | 0.0000 | NOT TESTED | 46 | 1092.1 | 278.7 | 180 / 10 | /api/dropdowns/supplyDaysPerTerm 77ms |
| public /signatory-approval/invalid-audit-token | RENDER | 122 | 41 | 124 | 0.0000 | NOT TESTED | 44 | 1152.6 | 335.9 | 124 / 25 | /api/signatory-approvals/invalid-audit-token 45ms |
| public /terms | RENDER | 98 | 56 | 112 | 0.0000 | NOT TESTED | 43 | 1089.3 | 282.7 | 112 / 9 | /api/dropdowns/themeAccent 19ms |
| public /audit-invalid-route | RENDER | 93 | 27 | 76 | 0.0000 | NOT TESTED | 34 | 1075.5 | 278.7 | 76 / 16 | No observed API in window |
| public /founding-schools%20(1)%20(1).html | RENDER | 674 | 45 | 628 | 0.0014 | NOT TESTED | 14 | 193.0 | 67.9 | 628 / 13 | /api/dropdowns/legacySchoolTier 37ms |
| public /founding-teachers%20(1).html | RENDER | 254 | 40 | 228 | 0.0046 | NOT TESTED | 13 | 186.7 | 67.9 | 228 / 9 | /api/dropdowns/legacyTeacherRole 31ms |
| school /applications | RENDER | 326 | 147 | 572 | 0.0007 | NOT TESTED | 42 | 1780.9 | 974.3 | 140 / 21 | /api/onboarding/me 163ms |
| school /billing | RENDER | 255 | 158 | 472 | 0.0010 | NOT TESTED | 42 | 1758.3 | 954.4 | 156 / 18 | /api/onboarding/me 145ms |
| school /bookings | RENDER | 201 | 146 | 604 | 0.0069 | NOT TESTED | 46 | 1834.1 | 974.1 | 140 / 15 | /api/onboarding/me 160ms |
| school /calendar | RENDER | 181 | 166 | 476 | 0.1173 | NOT TESTED | 44 | 1759.6 | 954.7 | 144 / 15 | /api/onboarding/me 186ms |
| school /dashboard | RENDER | 268 | 232 | 468 | 0.1173 | NOT TESTED | 44 | 1760.0 | 955.0 | 136 / 14 | /api/onboarding/me 156ms |
| school /find-jobs | RENDER | 188 | 178 | 452 | 0.1173 | NOT TESTED | 44 | 1758.9 | 954.3 | 124 / 16 | /api/onboarding/me 140ms |
| school /find-teachers | RENDER | 183 | 139 | 736 | 0.0024 | NOT TESTED | 47 | 2436.7 | 973.8 | 136 / 15 | /api/onboarding/me 281ms |
| school /institution-profile | RENDER | 239 | 162 | 472 | 0.0007 | NOT TESTED | 40 | 1772.9 | 973.7 | 156 / 18 | /api/onboarding/me 213ms |
| school /job-detail | RENDER | 178 | 203 | 448 | 0.0007 | NOT TESTED | 40 | 1773.6 | 974.3 | 132 / 15 | /api/onboarding/me 115ms |
| school /job-invitations | RENDER | 185 | 141 | 448 | 0.0025 | NOT TESTED | 44 | 1836.7 | 974.1 | 132 / 19 | /api/onboarding/me 119ms |
| school /job-invitations/00000000-0000-4000-8000-000000000000 | RENDER | 254 | 124 | 516 | 0.0007 | NOT TESTED | 42 | 1774.5 | 974.3 | 168 / 28 | /api/onboarding/me 124ms |
| school /messaging | RENDER | 226 | 150 | 580 | 0.0009 | NOT TESTED | 45 | 1883.9 | 973.9 | 136 / 17 | /api/onboarding/me 131ms |
| school /my-profile | RENDER | 180 | 153 | 1408 | 0.0012 | NOT TESTED | 46 | 1805.1 | 949.7 | 136 / 20 | /api/my-profile/applications 353ms |
| school /onboarding | ERROR | 173 | 111 | 788 | 0.0000 | NOT TESTED | 53 | 1429.3 | 616.3 | 124 / 17 | /api/auth/providers 8ms |
| school /payouts/return | ERROR | 147 | 135 | 188 | 0.0000 | NOT TESTED | 65 | 1449.7 | 360.1 | 88 / 18 | No observed API in window |
| school /post-job | ERROR | 160 | 191 | 228 | 0.0000 | NOT TESTED | 41 | 1331.4 | 525.7 | 112 / 19 | No observed API in window |
| school /security | ERROR | 179 | 129 | 232 | 0.0000 | NOT TESTED | 41 | 1331.4 | 525.7 | 120 / 17 | No observed API in window |
| school /settings | ERROR | 206 | 144 | 240 | 0.0000 | NOT TESTED | 41 | 1331.4 | 525.7 | 120 / 22 | No observed API in window |
| school /teacher-profile | ERROR | 191 | 130 | 224 | 0.0000 | NOT TESTED | 41 | 1331.4 | 525.7 | 144 / 18 | No observed API in window |
| school /post-auth | ERROR | 208 | 120 | 260 | 0.0000 | NOT TESTED | 24 | 1040.8 | 253.3 | 128 / 17 | No observed API in window |
| teacher /applications | RENDER | 149 | 134 | 456 | 0.0011 | NOT TESTED | 42 | 1774.2 | 973.9 | 124 / 13 | /api/onboarding/me 89ms |
| teacher /billing | RENDER | 173 | 128 | 480 | 0.0631 | NOT TESTED | 44 | 1780.8 | 974.0 | 148 / 16 | /api/payments/payout-account/balance 534ms |
| teacher /bookings | RENDER | 156 | 115 | 536 | 0.0280 | NOT TESTED | 45 | 1805.1 | 974.0 | 124 / 8 | /api/onboarding/me 90ms |
| teacher /calendar | RENDER | 154 | 94 | 452 | 0.0007 | NOT TESTED | 40 | 1773.2 | 973.8 | 120 / 13 | /api/onboarding/me 85ms |
| teacher /dashboard | RENDER | 150 | 126 | 652 | 0.0220 | NOT TESTED | 53 | 1863.0 | 973.8 | 120 / 13 | /api/payments/payout-account/balance 627ms |
| teacher /find-jobs | RENDER | 157 | 128 | 536 | 0.0006 | NOT TESTED | 42 | 1773.6 | 974.1 | 140 / 12 | /api/onboarding/me 89ms |
| teacher /find-teachers | RENDER | 146 | 89 | 552 | 0.0220 | NOT TESTED | 53 | 1843.9 | 954.5 | 120 / 12 | /api/payments/payout-account/balance 540ms |
| teacher /institution-profile | RENDER | 211 | 109 | 460 | 0.0006 | NOT TESTED | 40 | 1753.0 | 954.5 | 148 / 9 | /api/onboarding/me 73ms |
| teacher /job-detail | RENDER | 157 | 137 | 452 | 0.0006 | NOT TESTED | 40 | 1772.3 | 973.8 | 136 / 11 | /api/onboarding/me 69ms |
| teacher /job-invitations | RENDER | 143 | 109 | 420 | 0.0021 | NOT TESTED | 43 | 1787.2 | 954.5 | 124 / 12 | /api/onboarding/me 92ms |
| teacher /job-invitations/00000000-0000-4000-8000-000000000000 | RENDER | 174 | 152 | 516 | 0.0006 | NOT TESTED | 42 | 1773.4 | 973.9 | 132 / 14 | /api/onboarding/me 124ms |
| teacher /messaging | RENDER | 168 | 108 | 548 | 0.0009 | NOT TESTED | 44 | 1837.6 | 954.4 | 136 / 14 | /api/onboarding/me 115ms |
| teacher /my-profile | RENDER | 154 | 100 | 624 | 0.0011 | NOT TESTED | 45 | 1774.9 | 954.4 | 128 / 14 | /api/onboarding/me 142ms |
| teacher /onboarding | REDIRECT | 156 | 113 | 992 | 0.0220 | NOT TESTED | 65 | 1937.0 | 1045.3 | 136 / 13 | /api/payments/payout-account/balance 856ms |
| teacher /payouts/return | RENDER | 113 | 40 | 100 | 0.0046 | NOT TESTED | 36 | 1589.6 | 796.7 | 100 / 19 | /api/payments/payout-account 21ms |
| teacher /post-job | RENDER | 171 | 108 | 576 | 0.0220 | NOT TESTED | 53 | 1843.5 | 954.3 | 128 / 12 | /api/payments/payout-account/balance 541ms |
| teacher /security | RENDER | 144 | 97 | 508 | 0.0006 | NOT TESTED | 41 | 1772.6 | 973.6 | 112 / 9 | /api/onboarding/me 80ms |
| teacher /settings | RENDER | 164 | 99 | 624 | 0.0012 | NOT TESTED | 50 | 2465.2 | 954.3 | 140 / 12 | /api/dropdowns/skill 144ms |
| teacher /teacher-profile | RENDER | 163 | 111 | 444 | 0.0006 | NOT TESTED | 40 | 1752.8 | 954.3 | 128 / 13 | /api/onboarding/me 79ms |
| teacher /post-auth | REDIRECT | 135 | 116 | 1276 | 0.0220 | NOT TESTED | 59 | 1891.2 | 1006.9 | 128 / 12 | /api/payments/payout-account/balance 587ms |
| school-retest /onboarding | REDIRECT | 148 | 152 | 852 | 0.1173 | NOT TESTED | 56 | 1852.6 | 1045.1 | 116 / 10 | /api/onboarding/me 155ms |
| school-retest /post-job | RENDER | 219 | 127 | 512 | 0.0007 | NOT TESTED | 44 | 1835.4 | 954.7 | 132 / 15 | /api/onboarding/me 114ms |
| school-retest /security | RENDER | 236 | 140 | 520 | 0.0007 | NOT TESTED | 41 | 1754.1 | 954.4 | 140 / 13 | /api/onboarding/me 105ms |
| school-retest /settings | RENDER | 183 | 181 | 556 | 0.0012 | NOT TESTED | 50 | 2492.9 | 954.4 | 124 / 14 | /api/onboarding/me 237ms |
| school-retest /teacher-profile | RENDER | 186 | 132 | 444 | 0.0007 | NOT TESTED | 40 | 1753.7 | 954.4 | 128 / 11 | /api/onboarding/me 142ms |
| school-retest /post-auth | REDIRECT | 222 | 132 | 1156 | 0.1173 | NOT TESTED | 50 | 1807.6 | 1007.2 | 160 / 9 | /api/onboarding/me 230ms |
| teacher-detail /job-invitations/f9cde211-d44b-4ece-b42f-442f25d650c3 | RENDER | 161 | 136 | 564 | 0.0009 | NOT TESTED | 43 | 1809.8 | 981.4 | 136 / 16 | /api/onboarding/me 93ms |
| teacher-detail /job-detail?jobId=58cf53ed-115f-4bc1-a102-0ac6b7b05a6e | RENDER | 191 | 101 | 560 | 0.0009 | NOT TESTED | 43 | 1810.1 | 981.5 | 148 / 16 | /api/onboarding/me 98ms |
| teacher-detail /institution-profile?institutionId=b1d3d5e6-3e76-409a-8a8f-1c1ed11a6225 | RENDER | 135 | 121 | 528 | 0.0012 | NOT TESTED | 43 | 1806.9 | 974.1 | 112 / 9 | /api/onboarding/me 104ms |


| Route family | Rerender evidence | Caching / lazy opportunities | Primary bottleneck and recommendation | Verification |
| --- | --- | --- | --- | --- |
| Public / auth | No React Profiler capture | PF-01/PF-04; retain static server markup | Global fonts/CSS; auth mount gate and login CLS (PF-15) | Transfer + browser layout measured; precise memo benefits NOT TESTED |
| All workspace routes | RouteShell creates fresh state/routeProps/provider value; impact unprofiled | PF-02/PF-03/PF-05/PF-10/PF-13 | Split eager screen imports, avoid duplicate snapshot, preserve private data | Import/call path confirmed; no React render duration |
| School dashboard | Per-row count observers | PF-06; job-list aggregate counts | Six extra count requests for six rows; PF-14 layout movement | Live requests / initial shift measured |
| Teacher dashboard | 30s clock rerenders; calculations called on render | PF-08; private summary API | Entire-history aggregation; 5.852s throttled LCP | Source pattern + mobile metric |
| Find jobs | Draft score/subject state updates change query keys | PF-11; active feed + cancellation | Unneeded hidden feed and intermediate queries; 5.708s mobile LCP | Source + initial requests |
| Teacher directory / profiles | Existing memoized filters; small dataset | Keep paginated directory; images appropriate to display size | Do not virtualize 12-item page blindly; fix image contract and review pagination | Live sparse data; scale NOT TESTED |
| Applications / messaging | Grouping/summaries depend on invitation data | PF-09; lazy thread-specific data | All invitation history refresh; list-row memo only after profiling | Source + live read flows |
| My Profile | Aggregations in server query layer | PF-07; private paginated history | Full-account fanout before slicing page | Source; large account time NOT TESTED |
| Billing / bookings / payouts | No evidence for blind memoization | PF-12; lazy secure payment boundaries | Settled invoice polling and eager third-party scripts | Source + resource traces; transactions NOT TESTED |
| Security / settings / onboarding | Large forms; no commit profiling | Maintain private reads; split settings/phone/editor bundles | Initial global costs; fresh onboarding not accessible with approved accounts | Successful settings/security reads; setup wizard NOT TESTED |
| Signatory / dynamic errors / post-auth | No meaningful expensive local calculation established | Never share bearer approval state in public caches | Correct error recovery; valid-token flow not tested | Invalid token + role transitions tested |
| Standalone HTML prototypes | Not React components | Remove from public artifact rather than optimize duplicates | Broken resources, accessible-name/contrast failures | Browser confirmed |


### C. Slowest pages (successful representative mobile samples)

| Role / route | Cold LCP ms | Load ms | CLS | Transfer KiB |
| --- | --- | --- | --- | --- |
| teacher /settings | 6136 | 12393 | 0.0015 | 2457.4 |
| teacher /dashboard | 5852 | 10172 | 0.0068 | 1789.6 |
| teacher /find-jobs | 5708 | 9943 | 0.0082 | 1753.0 |
| public / | 1372 | 6223 | 0.0000 | 1098.0 |
| public /founding-teachers | 1284 | 6256 | 0.0000 | 1113.4 |
| public /login | 1060 | 5890 | 0.2134 | 1061.7 |


### D. Slowest observed API requests

These are browser durations across local lab runs, including retries/throttle/poll windows; not database execution time. Errors, signed previews and third-party images are not ranked as APIs here. No claim about production p95.

| Role / page | Endpoint | Duration ms | Condition |
| --- | --- | --- | --- |
| teacher /onboarding | /api/payments/payout-account/balance | 856 | cold unthrottled |
| teacher /dashboard | /api/payments/payout-account/balance | 627 | cold unthrottled |
| teacher /dashboard | /api/payments/payout-account/balance | 587 | warm unthrottled |
| teacher /post-auth | /api/payments/payout-account/balance | 587 | cold unthrottled |
| teacher /find-teachers | /api/payments/payout-account/balance | 569 | warm unthrottled |
| teacher /post-auth | /api/payments/payout-account/balance | 567 | warm unthrottled |
| teacher /post-job | /api/payments/payout-account/balance | 541 | cold unthrottled |
| teacher /find-teachers | /api/payments/payout-account/balance | 540 | cold unthrottled |
| teacher /billing | /api/payments/payout-account/balance | 534 | cold unthrottled |
| teacher /post-job | /api/payments/payout-account/balance | 534 | warm unthrottled |
| teacher /onboarding | /api/payments/payout-account/balance | 533 | warm unthrottled |
| teacher /billing | /api/payments/payout-account/balance | 524 | warm unthrottled |
| teacher /onboarding | /api/onboarding/me | 357 | cold unthrottled |
| school /my-profile | /api/my-profile/applications?page=1&limit=6 | 353 | cold unthrottled |
| school /my-profile | /api/my-profile/applications?page=1&limit=6 | 328 | warm unthrottled |


### E. React rerender problems

**No React DevTools Profiler/commit timings were captured.** RouteShell recreates go, routeProps and its context value on render; toast/theme changes can propagate through the selected screen. Messaging keeps drafts at the page level. Those are profiling targets, not confirmed slow renders. Date clocks in invitation/dashboard hooks intentionally update expiring states and are cleaned up. Socket subscriptions and theme observers have cleanup; no memory leak was established.

### F. React.memo opportunities

Candidate: extracted message rows/thread-list rows during composer typing, or large application rows with expensive rich text. First profile a representative long list. Memo only works if unchanged props are stable. Do not wrap every Field, Button, Avatar or tiny card; no measured evidence justifies that. The per-file component inventory below records this decision for all 133 files.

### G. useMemo opportunities

Candidates: ApplicationsJobList invitationSummaries/map on unrelated renders; teacher-dashboard derived summaries if large arrays remain after endpoint optimization. Messaging already memoizes conversation lists/groups; teacher filters and teaching catalogue already use memoization. Small number formatting, one-page arrays and Calendar's 35 cells are not meaningful optimization targets. Fix data volume first.

### H. useCallback opportunities

Stabilize RouteShell.go or row actions only alongside a demonstrated memoized child boundary. Existing toast/dismiss callbacks and modal closeRef already handle identity concerns. Adding callbacks alone will not reduce network requests or split the bundle.

### I. useRef opportunities

Keep visual input/draft/validation state as state. Refs are suitable for abort controllers, timers and latest callbacks only when those values do not affect the render; several components already do this. No new useRef conversion is justified by measured evidence. Do not conceal needed UI updates in refs.

### J. Client-side caching opportunities

Current defaults: 30s staleTime, 5min gcTime, no window-focus refetch, one query retry except 429, zero mutation retry. Keys contain filters/IDs; multiple identical observers share a provider cache. Hooks override focus/mount/poll policies. Hydrate minimal onboarding data; narrow invalidation; eliminate whole-history polling; thread Query signals into fetchJson. Avoid persistent storage of private records. A second data-cache library is unnecessary.

### K. Server-side caching opportunities

Keep auth, compliance decisions, balances, private messages/documents, payment secrets and approval tokens uncached in public/shared caches. Request-scoped deduplication of authenticated reads is preferable to global memoization. Public dropdown/catalogue reads could use a short **30–60s proposed initial TTL** only if administrative revision invalidation and failure behavior are agreed; current no-store may deliberately prioritize immediate option removal. That TTL is a starting hypothesis, not a measured optimum. Do not add Redis without cache-hit/latency evidence.

### L. Database and backend opportunities

Backend source is present and read-only inspected. High-confidence work: consolidate per-job application counts and replace frontend-server whole-history aggregations with authorized paginated backend queries. Matching limits candidates/jobs to 2,000 and batches availability checks; it is **not** an unbounded N+1 instructor lookup. Applicant ranking still loads all applicants then scores/sorts before pagination. Potential compound indexes for actual filters/orderings need EXPLAIN on representative data: job poster/status/createdAt, application job/status/date, invoice/booking ownership/status/date and rating-filter access. Existing Prisma indexes already cover many single/compound relationships; no missing-index claim is confirmed without a plan. Rate limiter executes sequential PostgreSQL counter upserts per applicable identity; measure before changing architecture. Reviews use transactional paginated findMany/count. Database timing, index selectivity and Redis benefit: **NOT TESTED**.

### M. Bundle-size problems

PF-02/PF-03 are supported by real transfer traces. Largest emitted assets below are **raw build bytes and local gzip estimates**, not automatically bytes every page downloads. Similar-sized chunks do not prove duplicated downloads or duplicate modules. No exhaustive tree-shaking or unused-JS coverage claim.

| Build asset | Raw bytes | Gzip estimate bytes |
| --- | --- | --- |
| .next/static/chunks/28mg3rttvml_n.js | 513125 | 136238 |
| .next/static/chunks/3wcd_xpb1gqws.js | 226355 | 70727 |
| .next/static/chunks/038_ubsu4l8i8.js | 198414 | 51540 |
| .next/static/chunks/0ytn512_qpbaj.js | 198414 | 51372 |
| .next/static/chunks/2olizsd49x3ot.js | 198414 | 53139 |
| .next/static/chunks/41f60an0_bsqn.js | 196900 | 56142 |
| .next/static/chunks/0xvcn9ahb2pyu.js | 176624 | 35582 |
| .next/static/chunks/1c01k5bmwuh0g.js | 138003 | 37536 |
| .next/static/chunks/1_l_ewr8kq8s0.css | 122515 | 23762 |
| .next/static/chunks/0cz1d0mv5g_q7.js | 112594 | 39627 |
| .next/static/chunks/413zy0505-4nd.css | 107645 | 18443 |
| .next/static/chunks/1rcvbr008q1_x.js | 68357 | 23709 |


### N. Images, fonts and static assets

Font payload dominates public cold transfer. Profile-image keys fail on several DTO paths while directory/profile display URLs work. Avatar uses Image preload plus a background image, with fixed size/initials fallback; no responsive source variants are provided. Exact image-original dimensions/production CDN rendition behavior were not measured, so do not claim oversized originals solely from source. Hero graphics are primarily HTML/CSS; there is no evidence of a large raster hero being lazily loaded. Root disables Next image optimization; evaluate actual uploaded images before choosing a future thumbnail strategy. Standalone HTML duplicates a 252,239-byte libphonenumber asset and uses broken logo references.

| Asset | Bytes |
| --- | --- |
| app/fonts/InterVariable-Italic.woff2 | 387976 |
| app/fonts/InterVariable.woff2 | 352240 |
| public/vendor/libphonenumber-max.js | 252239 |
| public/founding-teachers (1).html | 38487 |
| public/founding-schools (1) (1).html | 37376 |
| app/fonts/Inter-LICENSE.txt | 4472 |
| public/uk-phone-validation.js | 3774 |
| public/dynamic-dropdowns.js | 2522 |
| public/dropdown-theme.css | 2064 |
| public/vendor/libphonenumber-LICENSE.txt | 1129 |
| public/vendor/README.txt | 494 |
| public/favicon.svg | 463 |


### O. Navigation and interaction delays

Cold transfer, snapshot waterfalls and whole-history queries are established causes of potential waiting. Search cancellation/debounce issues are source-confirmed. No quantitative interaction-to-paint or route-click duration was obtained; typing freezes and layout thrashing were not observed/proven. Modal/menu keyboard checks passed where named. Back/forward cache restoration and long-session memory behavior remain NOT TESTED.

### P. Mobile performance

| Role / route | Condition | Outcome | Load ms | LCP ms | Session CLS | Requests | Transfer KiB |
| --- | --- | --- | --- | --- | --- | --- | --- |
| teacher /dashboard | mobile-cold | Successful observed state | 10172 | 5852 | 0.0068 | 53 | 1789.6 |
| teacher /dashboard | mobile-warm | Successful observed state | 394 | 624 | 0.0162 | 51 | 53.9 |
| teacher /dashboard | tablet-cold | Successful observed state | 156 | 604 | 0.0122 | 53 | 1836.6 |
| teacher /find-jobs | mobile-cold | Successful observed state | 9943 | 5708 | 0.0082 | 42 | 1753.0 |
| teacher /find-jobs | mobile-warm | Successful observed state | 369 | 1000 | 0.0082 | 40 | 17.3 |
| teacher /find-jobs | tablet-cold | Successful observed state | 174 | 512 | 0.0099 | 42 | 1753.0 |
| teacher /settings | mobile-cold | Successful observed state | 12393 | 6136 | 0.0015 | 50 | 2457.4 |
| teacher /settings | mobile-warm | Successful observed state | 437 | 1296 | 0.0015 | 47 | 141.9 |
| teacher /settings | tablet-cold | Successful observed state | 158 | 592 | 0.0020 | 50 | 2477.0 |
| school /dashboard | mobile-cold | ERROR SCREEN — NOT a page benchmark | 7256 | 3008 | 0.0000 | 41 | 1327.6 |
| school /dashboard | mobile-warm | ERROR SCREEN — NOT a page benchmark | 426 | 648 | 0.0000 | 39 | 22.4 |
| school /dashboard | tablet-cold | ERROR SCREEN — NOT a page benchmark | 153 | 204 | 0.0000 | 41 | 1327.6 |
| school /find-teachers | mobile-cold | ERROR SCREEN — NOT a page benchmark | 7290 | 2996 | 0.0000 | 41 | 1327.6 |
| school /find-teachers | mobile-warm | ERROR SCREEN — NOT a page benchmark | 405 | 580 | 0.0000 | 39 | 22.4 |
| school /find-teachers | tablet-cold | ERROR SCREEN — NOT a page benchmark | 149 | 176 | 0.0000 | 41 | 1327.5 |
| school /post-job | mobile-cold | ERROR SCREEN — NOT a page benchmark | 7267 | 3036 | 0.0000 | 41 | 1327.6 |
| school /post-job | mobile-warm | ERROR SCREEN — NOT a page benchmark | 410 | 596 | 0.0000 | 39 | 22.4 |
| school /post-job | tablet-cold | ERROR SCREEN — NOT a page benchmark | 213 | 264 | 0.0000 | 41 | 1327.6 |
| public / | mobile-cold | Successful observed state | 6223 | 1372 | 0.0000 | 46 | 1098.0 |
| public / | mobile-warm | Successful observed state | 387 | 704 | 0.0000 | 44 | 28.6 |
| public / | tablet-cold | Successful observed state | 140 | 156 | 0.0000 | 46 | 1098.0 |
| public /login | mobile-cold | Successful observed state | 5890 | 1060 | 0.2134 | 27 | 1061.7 |
| public /login | mobile-warm | Successful observed state | 415 | 560 | 0.0000 | 25 | 11.4 |
| public /login | tablet-cold | Successful observed state | 99 | 136 | 0.0000 | 27 | 1061.7 |
| public /founding-teachers | mobile-cold | Successful observed state | 6256 | 1284 | 0.0000 | 44 | 1113.4 |
| public /founding-teachers | mobile-warm | Successful observed state | 410 | 644 | 0.0000 | 42 | 53.1 |
| public /founding-teachers | tablet-cold | Successful observed state | 153 | 156 | 0.0000 | 46 | 1115.3 |


### Q. Core Web Vitals findings

Targets: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1. Teacher cold-mobile LCP misses the target in all three sampled successful pages. Public sampled LCP is below target but this does not imply fast hydration: cold load is ~5.9–6.3s. Login cold CLS 0.213 misses the target. School initial desktop shift diagnostic 0.117 needs session-window trace confirmation. **INP NOT TESTED.** There is no RUM distribution, CrUX dataset or field percentile in this report.

### R. Top 20 recommended performance improvements

| Rank | Action | Impact / confidence |
| --- | --- | --- |
| 1 | Reduce duplicate compliance snapshots and correct read-rate-limit coupling (PF-05, UX-02) | High; source + reproduced failure |
| 2 | Defer unnecessary Stripe/Connect initialization (PF-02) | High; ~557 KB sampled transfer |
| 3 | Subset and selectively preload fonts (PF-01) | High; 740 KB font payload |
| 4 | Split the broad client RouteShell (PF-03) | High; emitted/import evidence |
| 5 | Stabilize login hydration/font layout (PF-15) | High; measured CLS |
| 6 | Add applicant counts to authorized job listing (PF-06) | High; six extra requests observed |
| 7 | Replace school profile history fanout (PF-07) | High at scale; source confirmed |
| 8 | Return compact teacher dashboard summary (PF-08) | High at scale; source confirmed |
| 9 | Replace all-invitation polling with scoped summaries (PF-09) | High at scale; source confirmed |
| 10 | Wire cancellation into all query reads (PF-10) | Medium; code path confirmed |
| 11 | Gate inactive job feed and commit/debounce filters (PF-11) | Medium; source + initial requests |
| 12 | Stop fast polling of settled invoices (PF-12) | Medium; source confirmed |
| 13 | Separate route-specific CSS (PF-04) | Low/medium; global bytes measured; unused portion unknown |
| 14 | Reserve dashboard loading geometry (PF-14) | Medium; initial shift measured; attribution pending |
| 15 | Fix broken profile image URLs (UX-03) | Medium; repeated 404s confirmed |
| 16 | Keep review pagination instead of dropping it (UX-09) | Medium; contract mismatch confirmed |
| 17 | Use explicit private HTTP response policies (PF-13) | High correctness; no speedup promised |
| 18 | Consider revision-aware public dropdown caching | SUSPECTED opportunity; must preserve option freshness |
| 19 | Profile messaging rows before adding memo boundaries | SUSPECTED; no commit measurements |
| 20 | Profile matching/ranking plans before index/server-cache changes | SUSPECTED; database measurements missing |


### S. Implementation complexity and T. Expected benefits/risks

No optimization was applied. Estimates are qualitative, not delivery commitments or speedup promises. Detailed per-opportunity fields below explicitly assess React.memo, useMemo, useCallback, useRef, caching, backend changes and lazy loading.

#### PF-01 — Both full Inter fonts preload on every App Router page

| Field | Assessment |
| --- | --- |
| Severity / impact / status | P2 / High / CONFIRMED — transfer measurements |
| Route / file / function | All App Router pages — app/layout.tsx:23; app/fonts/InterVariable.woff2; app/fonts/InterVariable-Italic.woff2 — RootLayout localFont |
| Current behavior and evidence | Normal font is 352,240 bytes; italic is 387,976 bytes. Both preload globally: 740,216 payload bytes before considering headers. Home cold trace includes both. Evidence: browser-public.json / cold resources; inventory.json assets |
| Reproduce / viewport | Inspect cold page resources in browser-public.json. All unless stated |
| Root cause | Established by the cited source and evidence. |
| Recommended optimization | Subset to required glyphs and weights after checking content; avoid preloading unused italic face globally. Preserve font-display swap and fallback metrics. |
| React.memo / useMemo / useCallback / useRef | No — not the bottleneck; No — not the bottleneck; No — not the bottleneck; No — not the bottleneck |
| API caching / backend / lazy loading | No; No; Yes — noncritical font face |
| Estimated benefit (not measured after change) | Up to the unused 387,976-byte italic download can be deferred on pages that do not use it; subset savings unknown. |
| Complexity / risk | Medium / Low to medium; retain current contracts and verify affected flows. |
| Verification after implementation | Check font licensing, all language glyphs, visual fallback and CLS across routes after subsetting. |

#### PF-02 — Stripe and Connect download before payment UI is needed

| Field | Assessment |
| --- | --- |
| Severity / impact / status | P2 / High / CONFIRMED — cold network traces + imports |
| Route / file / function | All authenticated workspace pages — features/payments/stripe-client.ts:4; components/organisms/StripePayoutComponents.tsx:3; components/organisms/RouteShell.tsx:19 — Stripe loaders / RouteShell |
| Current behavior and evidence | School Applications downloads connect.js (~281,050 transfer bytes) and stripe.js (~276,261), despite no open payment form. Their decoded bodies total ~2.05 MB. Evidence: browser-school.json /applications resources; installed packages include pure entrypoints |
| Reproduce / viewport | Cold-load /applications or another non-payment workspace route. All unless stated |
| Root cause | Established by the cited source and evidence. |
| Recommended optimization | Use supported pure loaders and lazy payment/payout boundaries. Assess Stripe fraud-signal requirements with the payment integration before changing loading scope. |
| React.memo / useMemo / useCallback / useRef | No — not the bottleneck; No — not the bottleneck; No — not the bottleneck; No — not the bottleneck |
| API caching / backend / lazy loading | No; No; Yes |
| Estimated benefit (not measured after change) | Approximately 557 KB transferred can potentially move off the initial non-payment path in this sample; no LCP saving measured. |
| Complexity / risk | Medium / Medium: payment initialization and fraud signals must be regression-tested. |
| Verification after implementation | Verify no Stripe network requests before required UI on selected routes; exercise payment/session recreation in Stripe test mode. |

#### PF-03 — All workspace screens share an eagerly imported client shell

| Field | Assessment |
| --- | --- |
| Severity / impact / status | P2 / High / CONFIRMED — import graph + production chunks |
| Route / file / function | All authenticated workspace pages — components/organisms/RouteShell.tsx:16-36 — RouteShell |
| Current behavior and evidence | The client shell statically imports all feature pages and switches at runtime. A common application chunk is 513,125 raw bytes / 136,238 gzip bytes. Route-specific payment, settings and posting dependencies cross page boundaries. Evidence: inventory.json chunks; browser-school.json resources |
| Reproduce / viewport | Inspect shell imports and workspace cold resources. All unless stated |
| Root cause | Established by the cited source and evidence. |
| Recommended optimization | Keep a small shared shell; move page content behind route-level or lazy imports, preserving auth and navigation state. |
| React.memo / useMemo / useCallback / useRef | No — not the bottleneck; No — not the bottleneck; No — not the bottleneck; No — not the bottleneck |
| API caching / backend / lazy loading | No; No; Yes |
| Estimated benefit (not measured after change) | Lower per-route parse/download cost; exact removable bytes require a future bundle comparison. |
| Complexity / risk | Medium / Medium: chunk-loading/error boundaries and state preservation. |
| Verification after implementation | Compare emitted chunks and first-route script bytes for each role; test navigation and direct links. |

#### PF-04 — Workspace and editor CSS are globally delivered to marketing pages

| Field | Assessment |
| --- | --- |
| Severity / impact / status | P3 / Low / CONFIRMED — source + response bytes |
| Route / file / function | All App Router pages — app/layout.tsx:2-10 — Root stylesheet imports |
| Current behavior and evidence | Home downloads 122,515-byte and 107,645-byte CSS assets (roughly 42 KB combined transferred), while root imports account, workspace, dashboard and proposal styles. Evidence: browser-public.json / resources; app/layout.tsx |
| Reproduce / viewport | Inspect root imports and home resource entries. All unless stated |
| Root cause | Established by the cited source and evidence. |
| Recommended optimization | Move route-specific CSS to the owning layouts/components, keeping true foundations shared. Check CSS layer ordering and editor styles. |
| React.memo / useMemo / useCallback / useRef | No — not the bottleneck; No — not the bottleneck; No — not the bottleneck; No — not the bottleneck |
| API caching / backend / lazy loading | No; No; No |
| Estimated benefit (not measured after change) | Some of ~230 KB decoded CSS may be removed from public pages; used-CSS coverage was not measured. |
| Complexity / risk | Medium / Low to medium; retain current contracts and verify affected flows. |
| Verification after implementation | Visual comparison of every route and overlay; measure CSS coverage before selecting exact splits. |

#### PF-05 — Onboarding checks repeat across server render and client mount

| Field | Assessment |
| --- | --- |
| Severity / impact / status | P2 / High / CONFIRMED — source + browser endpoint calls |
| Route / file / function | All non-admin workspace routes — components/route-shell.tsx:36; components/organisms/RouteShell.tsx:85; features/onboarding/use-onboarding.ts:10; features/onboarding/actions.ts:503 — AppRouteShell / useOnboardingSnapshot |
| Current behavior and evidence | Server shell fetches full user/document/profile snapshot, then client starts a staleTime:0 snapshot request with no hydrated initial data. It repeats on window focus and every 60s. Snapshot serializes user → documents → profile → optional MAT approval. Evidence: browser-school.json requests; cited source; related UX-02 |
| Reproduce / viewport | Inspect SSR shell plus /api/onboarding/me on each cold/route load. All unless stated |
| Root cause | Established by the cited source and evidence. |
| Recommended optimization | Reuse request-scoped auth/profile data and hydrate the client with a minimal snapshot. Parallelize only independent reads; use approval events and a safe revalidation window. Keep authoritative access checks on the server. |
| React.memo / useMemo / useCallback / useRef | No — not the bottleneck; No — not the bottleneck; No — not the bottleneck; No — not the bottleneck |
| API caching / backend / lazy loading | Private short-lived state only; no shared user snapshot; Yes — a minimal status endpoint could reduce work; No |
| Estimated benefit (not measured after change) | Avoid one duplicate multi-request snapshot per visit where safe; total latency saving unmeasured. |
| Complexity / risk | Medium / High: stale authorization/compliance state must not grant access. |
| Verification after implementation | Count backend reads during navigation; change approval/doc status and verify immediate enforcement. |

#### PF-06 — Job list fires one applicant-count request per row

| Field | Assessment |
| --- | --- |
| Severity / impact / status | P2 / High / CONFIRMED — browser fanout + source |
| Route / file / function | /dashboard — components/organisms/JobManagementList.tsx:176 — JobManagementRow |
| Current behavior and evidence | Switching to All on the school dashboard renders six jobs and causes six /api/applications/job/<id>?limit=1 requests solely to read pagination.total. Evidence: edge-checks.json: rowRequests 6 / rowCount 6 |
| Reproduce / viewport | Open school dashboard; choose All; count application requests. All unless stated |
| Root cause | Established by the cited source and evidence. |
| Recommended optimization | Return counts with the authorized job listing or use one batched count endpoint; keep per-job applicant data lazy. |
| React.memo / useMemo / useCallback / useRef | No — not the bottleneck; No — not the bottleneck; No — not the bottleneck; No — not the bottleneck |
| API caching / backend / lazy loading | Use existing private job-list cache; invalidate counts on application changes; Yes — aggregate counts in listing; No |
| Estimated benefit (not measured after change) | Six extra browser requests per six-row page can be eliminated in the observed case. |
| Complexity / risk | Medium / Low to medium; retain current contracts and verify affected flows. |
| Verification after implementation | Exercise paging and new applications; verify counts and request fanout. |

#### PF-07 — School profile history aggregates entire datasets before paginating

| Field | Assessment |
| --- | --- |
| Severity / impact / status | P2 / High / CONFIRMED — source; large-account latency NOT TESTED |
| Route / file / function | /my-profile — features/my-profile/queries.ts:54,81 — listMyProfileApplications / listMyProfileReviews |
| Current behavior and evidence | School applications fetch all jobs then every job’s application pages in batches of five. Review history scans all booking pages. Only afterward is the requested page sliced. Budget allows up to 300 upstream requests / 30s. Evidence: inventory.json and cited source |
| Reproduce / viewport | Inspect the aggregation loops; use staging fixtures with many jobs/bookings for future runtime verification. All unless stated |
| Root cause | Established by the cited source and evidence. |
| Recommended optimization | Implement authorized backend history/review queries with server-side filtering, pagination and aggregate counts. |
| React.memo / useMemo / useCallback / useRef | No — not the bottleneck; No — not the bottleneck; No — not the bottleneck; No — not the bottleneck |
| API caching / backend / lazy loading | Retain bounded private query results; caching alone does not fix full-history work; Yes; No |
| Estimated benefit (not measured after change) | Work can become proportional to a requested page rather than total account history; no measured speedup. |
| Complexity / risk | Medium / Medium: preserve sorting, counts and complete-history correctness. |
| Verification after implementation | Compare results across page boundaries with >300 jobs and thousands of bookings; verify request budget no longer dominates. |

#### PF-08 — Teacher dashboard downloads every application page to calculate totals

| Field | Assessment |
| --- | --- |
| Severity / impact / status | P2 / High / CONFIRMED — source; large-account latency NOT TESTED |
| Route / file / function | /dashboard — features/dashboard/use-teacher-dashboard.ts:31,41,55; features/dashboard/teacher-dashboard-data.ts:111 — useTeacherDashboard / loadDashboardPages |
| Current behavior and evidence | Separate dashboard query keys collect all applications, confirmed future bookings and pending invitations. The normal list caches do not satisfy these aggregate queries. Evidence: inventory.json and cited source |
| Reproduce / viewport | Inspect loadDashboardPages usage; compare list and dashboard query keys. All unless stated |
| Root cause | Established by the cited source and evidence. |
| Recommended optimization | Provide compact authorized summary counts and bounded upcoming/pending previews; preserve full records in paginated workspaces. |
| React.memo / useMemo / useCallback / useRef | No — not the bottleneck; No — not the bottleneck; No — not the bottleneck; No — not the bottleneck |
| API caching / backend / lazy loading | Private summary 30s initially; events/mutations invalidate; Yes; No |
| Estimated benefit (not measured after change) | Less transfer, parsing and repeated aggregation for mature accounts; not quantified. |
| Complexity / risk | Medium / Medium: accurate totals across states/time zones. |
| Verification after implementation | Seed multiple pages and compare every summary count to authoritative data. |

#### PF-09 — Invitation summaries repeatedly load all invitation history

| Field | Assessment |
| --- | --- |
| Severity / impact / status | P2 / High / CONFIRMED — source; large-history timing NOT TESTED |
| Route / file / function | /applications, /messaging — features/invitations/use-invitations.ts:14; components/organisms/ApplicationsJobList.tsx:20; components/organisms/MessagingPage.tsx:73 — useAllInvitations |
| Current behavior and evidence | Reads limit=100 pages sequentially until complete (up to 1,000 pages). If any invitation is pending, the entire history polls every 30s. Evidence: inventory.json and cited source |
| Reproduce / viewport | Inspect hook in applications and messaging; simulate long history only in staging. All unless stated |
| Root cause | Established by the cited source and evidence. |
| Recommended optimization | Fetch bounded per-job/thread summaries or pending records, with cursor paging for history; apply socket updates to affected keys. |
| React.memo / useMemo / useCallback / useRef | No — not the bottleneck; No — not the bottleneck; No — not the bottleneck; No — not the bottleneck |
| API caching / backend / lazy loading | Private summaries; retain 30s baseline and invalidate targeted invitation/job keys; Yes; No |
| Estimated benefit (not measured after change) | Avoid repeated historical page traversal; magnitude depends on history size. |
| Complexity / risk | Medium / Low to medium; retain current contracts and verify affected flows. |
| Verification after implementation | Large history plus one pending invitation; inspect 2-minute request trace and summary accuracy. |

#### PF-10 — Query cancellation never reaches fetchJson network requests

| Field | Assessment |
| --- | --- |
| Severity / impact / status | P2 / Medium / CONFIRMED — source; wasted-duration measurement NOT TESTED |
| Route / file / function | All query-driven pages — lib/query/fetch-json.ts:14,32; features/jobs/use-jobs.ts:54; features/matching/use-matching.ts — fetchJson and queryFn callbacks |
| Current behavior and evidence | Query functions ignore TanStack’s supplied signal. fetchJson only uses a separate 60s timeout, so obsolete page/filter requests continue despite query cancellation or unmount. Evidence: inventory.json and cited source |
| Reproduce / viewport | Inspect queryFn signatures and request signal; reproduce with delayed staging responses and rapid filters. All unless stated |
| Root cause | Established by the cited source and evidence. |
| Recommended optimization | Accept and combine the query AbortSignal with timeout; pass it through all fetchJson hooks and multi-page loops. Preserve abort semantics. |
| React.memo / useMemo / useCallback / useRef | No — not the bottleneck; No — not the bottleneck; No — not the bottleneck; No — not the bottleneck |
| API caching / backend / lazy loading | Existing TanStack cache remains; cancellation is separate; No; No |
| Estimated benefit (not measured after change) | Less obsolete network/server work under fast navigation; unquantified. |
| Complexity / risk | Medium / Medium: do not convert intentional aborts into misleading errors. |
| Verification after implementation | Rapid filter/page changes; confirm old requests cancel and current data/errors remain correct. |

#### PF-11 — Job discovery fetches inactive feed and refetches as text changes

| Field | Assessment |
| --- | --- |
| Severity / impact / status | P2 / Medium / CONFIRMED — source + initial feed requests |
| Route / file / function | /find-jobs — components/organisms/FindJobsPage.tsx:32,39,52; components/molecules/TeachingSelectionFields.tsx:61 — FindJobsPage / CatalogueSubjectFilter |
| Current behavior and evidence | Both useJobs and useRecommendedJobs are enabled on mount. Minimum score and custom subject input change query keys on each valid edit; no debounce/apply boundary. Evidence: browser-teacher.json /find-jobs resources; source |
| Reproduce / viewport | Open For you and inspect both feed requests; type a multi-character custom subject on All jobs. All unless stated |
| Root cause | Established by the cited source and evidence. |
| Recommended optimization | Enable only the active feed (optionally prefetch deliberately); debounce text/search-like values or offer Apply; keep numeric drafts local until committed. |
| React.memo / useMemo / useCallback / useRef | No — not the bottleneck; No — not the bottleneck; No — not the bottleneck; No — not the bottleneck |
| API caching / backend / lazy loading | Existing keyed private TanStack queries; No; No |
| Estimated benefit (not measured after change) | Avoid inactive feed request and intermediate search requests; exact savings depend on interaction. |
| Complexity / risk | Medium / Low to medium; retain current contracts and verify affected flows. |
| Verification after implementation | Type rapidly, clear input and switch tabs; verify latest query, empty/loading states and cancellation. |

#### PF-12 — Completed invoices continue polling indefinitely

| Field | Assessment |
| --- | --- |
| Severity / impact / status | P2 / Medium / CONFIRMED — source; long idle capture NOT TESTED |
| Route / file / function | /billing, /bookings invoice modal — features/payments/use-payments.ts:83,105 — useMyInvoices / useInvoice |
| Current behavior and evidence | My invoices polls every 15s when any record is PAID; detail polls whenever status is not VOID. Paid historical data therefore triggers perpetual foreground refetches. Evidence: inventory.json and cited source |
| Reproduce / viewport | Inspect polling predicates on a paid invoice. All unless stated |
| Root cause | Established by the cited source and evidence. |
| Recommended optimization | Poll only unsettled/payment-in-flight states, refresh on relevant events/focus, and use a bounded reconciliation interval for mutable post-payment events. |
| React.memo / useMemo / useCallback / useRef | No — not the bottleneck; No — not the bottleneck; No — not the bottleneck; No — not the bottleneck |
| API caching / backend / lazy loading | Private; 15s for actively unsettled records only, e.g. 60s for settled reads subject to product requirements; No; No |
| Estimated benefit (not measured after change) | Remove up to four list polls/minute plus four detail polls/minute in a settled foreground view; code-derived estimate. |
| Complexity / risk | Medium / Medium: refunds, disputes and reversals remain possible; event handling/reconciliation required. |
| Verification after implementation | Paid, open, disputed, refunded and void invoices; ensure prompt updates without indefinite fast polling. |

#### PF-13 — Authenticated JSON responses lack explicit private/no-store HTTP headers

| Field | Assessment |
| --- | --- |
| Severity / impact / status | P2 / High / CONFIRMED — local response headers; cache leakage NOT TESTED |
| Route / file / function | Most authenticated API routes — app/api/settings/profile/route.ts:8; app/api/onboarding/me/route.ts:8; app/api/notifications/route.ts — Response.json handlers |
| Current behavior and evidence | Sample private JSON responses contain content-type and RSC Vary but no Cache-Control. Public dropdown responses explicitly use no-store. Backend fetch no-store does not declare the downstream response policy. Evidence: browser-school.json response headers; route handlers |
| Reproduce / viewport | Inspect captured response headers for settings, notifications, jobs and onboarding. All unless stated |
| Root cause | Established by the cited source and evidence. |
| Recommended optimization | Declare private, no-store for sensitive responses and signed previews/tickets; retain in-memory user-scoped Query caching where appropriate. Verify deployment/CDN policy separately. |
| React.memo / useMemo / useCallback / useRef | No — not the bottleneck; No — not the bottleneck; No — not the bottleneck; No — not the bottleneck |
| API caching / backend / lazy loading | Private in-memory only; never public/shared for user data; No; No |
| Estimated benefit (not measured after change) | Makes cache safety explicit; no claimed speed improvement or confirmed leak. |
| Complexity / risk | Medium / Low; test back/forward and intended local query caching. |
| Verification after implementation | Inspect origin and deployed CDN headers for two separate users; verify no shared cache reuse. |

#### PF-14 — School dashboard has a measurable initial layout shift

| Field | Assessment |
| --- | --- |
| Severity / impact / status | P2 / Medium / CONFIRMED — local initial-layout measurement; exact shifting node requires trace follow-up |
| Route / file / function | /dashboard — components/organisms/InstitutionDashboard.tsx:63; components/organisms/JobManagementList.tsx:93; components/styles/workspace.css — Hiring dashboard loading/empty states |
| Current behavior and evidence | Three school dashboard-equivalent cold renders recorded cumulative initial shifts of 0.11728, above 0.1. These were unthrottled 1440px samples before resizing. Evidence: browser-school.json /dashboard, /calendar, /find-jobs |
| Reproduce / viewport | Cold-load school dashboard with empty Active jobs; observe layout-shift entries during data settlement. 1440×1000 cold, local production build |
| Root cause | Layout movement is measured; precise DOM culprit is not established. These three URLs render the same dashboard, not three distinct defects. |
| Recommended optimization | Use stable skeleton/empty-state dimensions and reserved metric/card regions after identifying the largest shifting nodes. |
| React.memo / useMemo / useCallback / useRef | No — not the bottleneck; No — not the bottleneck; No — not the bottleneck; No — not the bottleneck |
| API caching / backend / lazy loading | No; No; No |
| Estimated benefit (not measured after change) | Reduce measured layout instability; amount not estimated. |
| Complexity / risk | Medium / Low to medium; retain current contracts and verify affected flows. |
| Verification after implementation | Capture a full layout-shift session-window trace and screenshots before/after; target CLS ≤0.1. Do not use failed school throttle runs as success-page measurements. |

#### PF-15 — Login shifts substantially during a cold mobile load

| Field | Assessment |
| --- | --- |
| Severity / impact / status | P2 / High / CONFIRMED — session-window CLS measurement |
| Route / file / function | /login — components/organisms/LoginRouteClient.tsx:436; components/molecules/Loaders.tsx:95; app/layout.tsx:23 — LoginRouteClient / AuthFlowLoader / font loading |
| Current behavior and evidence | A 390px cold load at 1.6Mbps, 150ms latency and 4x CPU recorded CLS 0.21338. The shift at 5.813s included section.auth-main, story text and the submit button. Warm load CLS was 0. Evidence: performance-public.json /login mobile-cold |
| Reproduce / viewport | Run performance.mjs public and inspect login cold shift entries; repeat runs to establish variance. 390×844, synthetic mobile throttle |
| Root cause | Shift is confirmed. Late font completion and the mount-gated loader are candidates; attribution between them is not established. |
| Recommended optimization | Keep the auth shell geometry stable through hydration and font swap; determine the dominant cause with a performance filmstrip, then reduce font/load gating and match fallback metrics. |
| React.memo / useMemo / useCallback / useRef | No — not the bottleneck; No — not the bottleneck; No — not the bottleneck; No — not the bottleneck |
| API caching / backend / lazy loading | No; No; No |
| Estimated benefit (not measured after change) | Lower layout instability; no quantified post-fix result. |
| Complexity / risk | Medium / Low to medium; retain current contracts and verify affected flows. |
| Verification after implementation | Repeat at least five cold loads with session-window CLS and filmstrip; verify form usability and focus during hydration. |

### U. Tests required after future optimization

1. Repeat baseline production-build cold/warm scenarios at least five times; compare distributions, bytes and request counts. Add field web-vitals collection only with an approved telemetry design.
2. Capture actual React profiling for large messaging/application states; only then choose memo boundaries.
3. Verify role/status changes, logout, session expiry and two-user isolation when hydrating or caching private data. Ensure private API headers remain private/no-store at the deployed CDN.
4. Exercise job/invitation/booking/payment mutation invalidation in a disposable environment; never trade stale compliance or financial correctness for speed.
5. Test realistic many-page datasets for dashboard/history/reviews; verify exact totals and pagination stability while new records arrive.
6. Re-run every requested width, populated/error/empty/loading states, keyboard/modal checks and axe after route/CSS/font splitting. Include actual mobile keyboard, 200% zoom and screen-reader review.
7. Use Stripe test mode for session creation, payment confirmation, retry, failed card, payout setup and webhook reconciliation; no such transaction was performed here.

## 10. API request and caching inventory

Every recognized fetch/fetchJson/api call site is retained in the following appendix and inventory.json (including wrappers and mutations); dynamic URLs are symbolic expressions, not guessed endpoints. **202 call sites are not 202 unique requests.** Server actions use Next transport URLs, so the backend path is shown where statically available. Socket.IO events and vendor SDK internals are separate from the explicit fetch inventory. No claim of exhaustively tracing every SDK-internal request.

Policy legend: **Q** existing private in-memory TanStack cache (default 30s stale/5min GC, hook overrides below); **P** public dropdown/catalogue candidate 30–60s with revision invalidation (not currently implemented); **S** security-sensitive/auth/document/payment-secret, no shared cache; **M** mutation/transaction, never response-cache/replay as a read; **D** direct GET without Query reuse, assess bounded private caching individually. Public profile here still means an authenticated marketplace view, not permission to shared-cache personal data.

For each call row, duplicate status is limited to established cases; 'not measured per call' is deliberate. Frequencies are code-derived schedules, not a production traffic estimate. Exact hook definitions including enabled/refetch options follow. Suggested TTLs are proposals requiring freshness validation; no new cache was introduced.

| # | Page/consumer | Component/function source | Endpoint/call | Frequency | Duplication | Current cache | Safe strategy / proposed lifetime | Invalidation | Expected benefit | Stale-data risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | /api/bookings/[id] | app/api/bookings/[id]/route.ts:10 GET | api.get `/bookings/${encodeURIComponent(id)}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 002 | /api/conversations/socket-ticket | app/api/conversations/socket-ticket/route.ts:13 POST | api.post "/conversations/socket-ticket" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 003 | /api/conversations/[id]/attachments | app/api/conversations/[id]/attachments/route.ts:33 POST | api.post `/conversations/${id}/attachments` | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 004 | /api/conversations/[id]/attachments | app/api/conversations/[id]/attachments/route.ts:38 POST | fetch started.upload.url | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 005 | /api/conversations/[id]/attachments/[attachmentId]/preview | app/api/conversations/[id]/attachments/[attachmentId]/preview/route.ts:14 GET | api.get `/conversations/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}/download-url` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | S — No shared/persistent cache; no TTL for secrets/actions | Session/auth/profile/token lifecycle; never serve expired authorization | Fewer repeated reads where safe; benefit NOT MEASURED | High; authorization/doc state must remain live |
| 006 | /api/conversations/[id]/attachments/[attachmentId]/preview | app/api/conversations/[id]/attachments/[attachmentId]/preview/route.ts:18 GET | fetch link.url | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | S — No shared/persistent cache; no TTL for secrets/actions | Session/auth/profile/token lifecycle; never serve expired authorization | Fewer repeated reads where safe; benefit NOT MEASURED | High; authorization/doc state must remain live |
| 007 | /api/dropdowns | app/api/dropdowns/route.ts:5 GET | api.get "/dropdowns" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | P — Optional public30–60s only with revision invalidation | Admin option/revision changes and validation failures | Fewer repeated reads where safe; benefit NOT MEASURED | Removed/changed options could appear stale |
| 008 | /api/dropdowns/[name] | app/api/dropdowns/[name]/route.ts:8 GET | api.get `/dropdowns/${encodeURIComponent(name)}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | P — Optional public30–60s only with revision invalidation | Admin option/revision changes and validation failures | Fewer repeated reads where safe; benefit NOT MEASURED | Removed/changed options could appear stale |
| 009 | /api/onboarding/documents/[documentId]/preview | app/api/onboarding/documents/[documentId]/preview/route.ts:27 GET | api.get `/documents/${encodeURIComponent(documentId)}/download-url` | On consumer request; exact runtime frequency NOT TESTED | Server/client snapshot overlap PF-05 | Explicit fetch no-store | S — No shared/persistent cache; no TTL for secrets/actions | Session/auth/profile/token lifecycle; never serve expired authorization | Fewer repeated reads where safe; benefit NOT MEASURED | High; authorization/doc state must remain live |
| 010 | /api/onboarding/documents/[documentId]/preview | app/api/onboarding/documents/[documentId]/preview/route.ts:34 GET | fetch sourceUrl | On consumer request; exact runtime frequency NOT TESTED | Server/client snapshot overlap PF-05 | Explicit fetch no-store | S — No shared/persistent cache; no TTL for secrets/actions | Session/auth/profile/token lifecycle; never serve expired authorization | Fewer repeated reads where safe; benefit NOT MEASURED | High; authorization/doc state must remain live |
| 011 | /api/payments/payout-account/instant-payout | app/api/payments/payout-account/instant-payout/route.ts:13 POST | api.post "/payments/payout-account/instant-payout" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 012 | /api/signatory-approvals/[token] | app/api/signatory-approvals/[token]/route.ts:17 GET | api.get `/signatory-approvals/token/${encodeURIComponent(token)}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | S — No shared/persistent cache; no TTL for secrets/actions | Session/auth/profile/token lifecycle; never serve expired authorization | Fewer repeated reads where safe; benefit NOT MEASURED | High; authorization/doc state must remain live |
| 013 | /api/signatory-approvals/[token] | app/api/signatory-approvals/[token]/route.ts:40 POST | api.post `/signatory-approvals/token/${encodeURIComponent(token)}/approve` | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 014 | /api/signatory-approvals/[token] | app/api/signatory-approvals/[token]/route.ts:48 POST | api.post `/signatory-approvals/token/${encodeURIComponent(token)}/decline` | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 015 | /api/teaching-catalogue | app/api/teaching-catalogue/route.ts:7 GET | api.get "/teaching-catalogue" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | P — Optional public30–60s only with revision invalidation | Admin option/revision changes and validation failures | Fewer repeated reads where safe; benefit NOT MEASURED | Removed/changed options could appear stale |
| 016 | Address forms | components/molecules/PostcodeLookup.tsx:28 lookupPostcodeArea | fetch `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.replace(/\s+/g, ""))}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | No persistent server cache proven; inspect explicit hook below | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 017 | Shared wrapper / importing consumers | components/organisms/AdminPayoutLookup.tsx:19 AdminPayoutLookup | fetchJson `/api/payments/payout-accounts/instructor/${encodeURIComponent(instructorId)}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 018 | Shared wrapper / importing consumers | components/organisms/MessageAttachmentPreview.tsx:60 load | fetch `/api/conversations/${encodeURIComponent(conversationId)}/attachments/${encodeURIComponent(attachment.id)}/preview` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | S — No shared/persistent cache; no TTL for secrets/actions | Session/auth/profile/token lifecycle; never serve expired authorization | Fewer repeated reads where safe; benefit NOT MEASURED | High; authorization/doc state must remain live |
| 019 | Shared wrapper / importing consumers | components/organisms/OnboardingRouteClient.tsx:202 uploadDocument | fetch "/api/onboarding/documents" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 020 | /signatory-approval/[token] | components/organisms/SignatoryApprovalPage.tsx:56 load | fetch `/api/signatory-approvals/${encodeURIComponent(token)}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | S — No shared/persistent cache; no TTL for secrets/actions | Session/auth/profile/token lifecycle; never serve expired authorization | Fewer repeated reads where safe; benefit NOT MEASURED | High; authorization/doc state must remain live |
| 021 | /signatory-approval/[token] | components/organisms/SignatoryApprovalPage.tsx:65 SignatoryApprovalPage | fetch `/api/signatory-approvals/${encodeURIComponent(token)}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | S — No shared/persistent cache; no TTL for secrets/actions | Session/auth/profile/token lifecycle; never serve expired authorization | Fewer repeated reads where safe; benefit NOT MEASURED | High; authorization/doc state must remain live |
| 022 | /signatory-approval/[token] | components/organisms/SignatoryApprovalPage.tsx:94 decide | fetch `/api/signatory-approvals/${encodeURIComponent(token)}` | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 023 | /applications; /job-detail; /dashboard; /my-profile | features/applications/actions.ts:31 createApplicationAction | api.post "/applications" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 024 | /applications; /job-detail; /dashboard; /my-profile | features/applications/actions.ts:49 updateApplicationStatusAction | api.patch `/applications/${input.id}/status` | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 025 | /applications; /job-detail; /dashboard; /my-profile | features/applications/queries.ts:15 getApplicationById | api.get `/applications/${applicationId}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 026 | /applications; /job-detail; /dashboard; /my-profile | features/applications/queries.ts:27 listApplicationHistory | api.get `/applications/${applicationId}/history` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 027 | /applications; /job-detail; /dashboard; /my-profile | features/applications/queries.ts:38 listApplicationsByJob | api.get `/applications/job/${jobId}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | No persistent server cache proven; inspect explicit hook below | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 028 | /applications; /job-detail; /dashboard; /my-profile | features/applications/queries.ts:58 listMyApplications | api.get "/applications/me" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | No persistent server cache proven; inspect explicit hook below | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 029 | /applications; /job-detail; /dashboard; /my-profile | features/applications/use-applications.ts:24 useJobApplications | fetchJson `/api/applications/job/${jobId}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 030 | /applications; /job-detail; /dashboard; /my-profile | features/applications/use-applications.ts:32 useApplication | fetchJson `/api/applications/${applicationId}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 031 | /applications; /job-detail; /dashboard; /my-profile | features/applications/use-applications.ts:40 useApplicationHistory | fetchJson `/api/applications/${applicationId}/history` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 032 | /applications; /job-detail; /dashboard; /my-profile | features/applications/use-applications.ts:48 useMyApplications | fetchJson "/api/applications/me" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 033 | /applications; /job-detail; /dashboard; /my-profile | features/applications/use-applications.ts:55 useActiveJobApplicantCount | fetchJson "/api/applications/active-jobs/count" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 034 | /login; /signup; /forgot-password; workspace shell | features/auth/actions.ts:93 readProfileApplicationStatus | api.get profilePath | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | S — No shared/persistent cache; no TTL for secrets/actions | Session/auth/profile/token lifecycle; never serve expired authorization | Fewer repeated reads where safe; benefit NOT MEASURED | High; authorization/doc state must remain live |
| 035 | /login; /signup; /forgot-password; workspace shell | features/auth/backend.ts:370 createEmailAccount | api.post backendAuthEndpoints.register | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 036 | /login; /signup; /forgot-password; workspace shell | features/auth/backend.ts:391 loginWithEmail | api.post backendAuthEndpoints.login | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 037 | /login; /signup; /forgot-password; workspace shell | features/auth/backend.ts:420 verifyEmail | api.post backendAuthEndpoints.verifyEmail | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 038 | /login; /signup; /forgot-password; workspace shell | features/auth/backend.ts:449 verifyTwoFactorLogin | api.post backendAuthEndpoints.verifyTwoFactor | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 039 | /login; /signup; /forgot-password; workspace shell | features/auth/backend.ts:472 resendEmailVerification | api.post backendAuthEndpoints.resendEmailVerification | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 040 | /login; /signup; /forgot-password; workspace shell | features/auth/backend.ts:492 requestPasswordReset | api.post backendAuthEndpoints.forgotPassword | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 041 | /login; /signup; /forgot-password; workspace shell | features/auth/backend.ts:520 resetPassword | api.post backendAuthEndpoints.resetPassword | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 042 | /login; /signup; /forgot-password; workspace shell | features/auth/backend.ts:560 exchangeOAuthAccount | api.post backendAuthEndpoints.oauthGoogle | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 043 | /login; /signup; /forgot-password; workspace shell | features/auth/backend.ts:585 refreshBackendAuth | api.post backendAuthEndpoints.refresh | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 044 | /login; /signup; /forgot-password; workspace shell | features/auth/phone-actions.ts:37 sendPhoneOtpAction | api.post "/auth/phone/otp/send" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 045 | /login; /signup; /forgot-password; workspace shell | features/auth/phone-actions.ts:62 verifyPhoneOtpAction | api.post "/auth/phone/otp/verify" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 046 | /login; /signup; /forgot-password; workspace shell | features/auth/queries.ts:14 getCurrentUser | api.get "/users/me" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | No persistent server cache proven; inspect explicit hook below | S — No shared/persistent cache; no TTL for secrets/actions | Session/auth/profile/token lifecycle; never serve expired authorization | Fewer repeated reads where safe; benefit NOT MEASURED | High; authorization/doc state must remain live |
| 047 | /login; /signup; /forgot-password; workspace shell | features/auth/two-factor-actions.ts:92 getTwoFactorStatusAction | api.get "/auth/2fa/status" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | No persistent server cache proven; inspect explicit hook below | S — No shared/persistent cache; no TTL for secrets/actions | Session/auth/profile/token lifecycle; never serve expired authorization | Fewer repeated reads where safe; benefit NOT MEASURED | High; authorization/doc state must remain live |
| 048 | /login; /signup; /forgot-password; workspace shell | features/auth/two-factor-actions.ts:100 startTwoFactorSetupAction | api.post "/auth/2fa/setup" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 049 | /login; /signup; /forgot-password; workspace shell | features/auth/two-factor-actions.ts:116 enableTwoFactorAction | api.post "/auth/2fa/enable" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 050 | /login; /signup; /forgot-password; workspace shell | features/auth/two-factor-actions.ts:135 disableTwoFactorAction | api.post "/auth/2fa/disable" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 051 | /login; /signup; /forgot-password; workspace shell | features/auth/two-factor-actions.ts:155 regenerateTwoFactorRecoveryCodesAction | api.post "/auth/2fa/recovery-codes" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 052 | /login; /signup; /forgot-password; workspace shell | features/auth/use-current-user.ts:12 useCurrentUser | fetchJson "/api/auth/me" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | S — No shared/persistent cache; no TTL for secrets/actions | Session/auth/profile/token lifecycle; never serve expired authorization | Fewer repeated reads where safe; benefit NOT MEASURED | High; authorization/doc state must remain live |
| 053 | /bookings; /dashboard; /my-profile | features/bookings/actions.ts:29 updateBookingStatusAction | api.patch `/bookings/${id}/${bookingActionPath[input.action]}` | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 054 | /bookings; /dashboard; /my-profile | features/bookings/actions.ts:51 createBookingReviewAction | api.post "/reviews" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 055 | /bookings; /dashboard; /my-profile | features/bookings/queries.ts:29 listMyBookings | api.get "/bookings/me" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 056 | /bookings; /dashboard; /my-profile | features/bookings/use-bookings.ts:12 useBooking | fetchJson `/api/bookings/${id}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 057 | /bookings; /dashboard; /my-profile | features/bookings/use-bookings.ts:26 useBookings | fetchJson "/api/bookings/me" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 058 | /; /founding-schools; /founding-teachers | features/contact/actions.ts:89 registerInterestAction | api.post "/contact/register-interest" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 059 | /; /founding-schools; /founding-teachers | features/contact/actions.ts:143 foundingInterestAction | api.post "/contact/founding-interest" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 060 | /; /founding-schools; /founding-teachers | features/contact/actions.ts:182 saveWaitlistDetailsAction | api.patch `/contact/founding-interest/${encodeURIComponent(id)}/details` | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 061 | /; /founding-schools; /founding-teachers | features/contact/waitlist-client.ts:25 submitWaitlistAction | fetchJson `/api/dropdowns/${name}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 062 | /; /founding-schools; /founding-teachers | features/contact/waitlist-client.ts:48 submitWaitlistDetailsAction | fetchJson "/api/dropdowns/waitlistPhase" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 063 | /messaging; workspace badges | features/conversations/actions.ts:18 startConversationAction | api.post "/conversations" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 064 | /messaging; workspace badges | features/conversations/actions.ts:30 openConversationForApplicationAction | api.get `/conversations/application/${id}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 065 | /messaging; workspace badges | features/conversations/actions.ts:40 openConversationForBookingAction | api.get `/conversations/booking/${bookingId.trim()}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 066 | /messaging; workspace badges | features/conversations/actions.ts:54 sendMessageAction | api.post `/conversations/${input.conversationId}/messages` | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 067 | /messaging; workspace badges | features/conversations/actions.ts:66 markConversationReadAction | api.post `/conversations/${conversationId}/read` | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 068 | /messaging; workspace badges | features/conversations/actions.ts:75 attachmentDownloadUrlAction | api.get `/conversations/${conversationId}/attachments/${attachmentId}/download-url` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | S — No shared/persistent cache; no TTL for secrets/actions | Session/auth/profile/token lifecycle; never serve expired authorization | Fewer repeated reads where safe; benefit NOT MEASURED | High; authorization/doc state must remain live |
| 069 | /messaging; workspace badges | features/conversations/queries.ts:16 listMyConversations | api.get "/conversations" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 070 | /messaging; workspace badges | features/conversations/queries.ts:30 getUnreadMessageCount | api.get "/conversations/unread-count" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 071 | /messaging; workspace badges | features/conversations/queries.ts:35 getConversation | api.get `/conversations/${id}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 072 | /messaging; workspace badges | features/conversations/queries.ts:39 listConversationThreads | api.get `/conversations/${id}/threads` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 073 | /messaging; workspace badges | features/conversations/queries.ts:48 listMessages | api.get `/conversations/${id}/messages` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 074 | /messaging; workspace badges | features/conversations/socket.ts:51 fetchTicket | fetch "/api/conversations/socket-ticket" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 075 | /messaging; workspace badges | features/conversations/use-conversations.ts:47 useConversations | fetchJson "/api/conversations" | Mount; list 30s, unread 60s, messages fallback30s | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 076 | /messaging; workspace badges | features/conversations/use-conversations.ts:59 useConversationThreads | fetchJson `/api/conversations/${conversation.id}/threads` | Mount; list 30s, unread 60s, messages fallback30s | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 077 | /messaging; workspace badges | features/conversations/use-conversations.ts:83 useUnreadMessages | fetchJson "/api/conversations/unread-count" | Mount; list 30s, unread 60s, messages fallback30s | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 078 | /messaging; workspace badges | features/conversations/use-conversations.ts:115 useConversation | fetchJson `/api/conversations/${id}` | Mount; list 30s, unread 60s, messages fallback30s | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 079 | /messaging; workspace badges | features/conversations/use-conversations.ts:141 useMessages | fetchJson `/api/conversations/${conversationId}/messages` | Mount; list 30s, unread 60s, messages fallback30s | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 080 | /messaging; workspace badges | features/conversations/use-conversations.ts:213 uploadAttachment | fetch `/api/conversations/${conversationId}/attachments` | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 081 | /messaging; workspace badges | features/conversations/use-conversations.ts:237 onMessage | fetchJson `/api/conversations/${payload.conversationId}` | Mount; list 30s, unread 60s, messages fallback30s | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 082 | /dashboard | features/dashboard/use-teacher-dashboard.ts:35 useTeacherDashboard | fetchJson "/api/bookings/me" | Mount/focus; multi-page; invitation 30s | Distinct summary keys PF-08 | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 083 | /dashboard | features/dashboard/use-teacher-dashboard.ts:47 useTeacherDashboard | fetchJson "/api/applications/me" | Mount/focus; multi-page; invitation 30s | Distinct summary keys PF-08 | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 084 | /dashboard | features/dashboard/use-teacher-dashboard.ts:60 useTeacherDashboard | fetchJson "/api/job-invitations/me" | Mount/focus; multi-page; invitation 30s | Distinct summary keys PF-08 | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 085 | Forms/theme/filter consumers | features/dropdowns/use-dropdown.ts:8 useDropdown | fetchJson `/api/dropdowns/${name}` | Mount, focus always, refresh event | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | P — Optional public30–60s only with revision invalidation | Admin option/revision changes and validation failures | Fewer repeated reads where safe; benefit NOT MEASURED | Removed/changed options could appear stale |
| 086 | /job-invitations; /applications; /messaging; /dashboard | features/invitations/actions.ts:28 createInvitationAction | api.post "/job-invitations" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 087 | /job-invitations; /applications; /messaging; /dashboard | features/invitations/actions.ts:35 createInvitationAction | api.post "/conversations" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 088 | /job-invitations; /applications; /messaging; /dashboard | features/invitations/actions.ts:41 createInvitationAction | api.get `/conversations/${conversation.id}/messages` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 089 | /job-invitations; /applications; /messaging; /dashboard | features/invitations/actions.ts:46 createInvitationAction | api.post `/conversations/${conversation.id}/messages` | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 090 | /job-invitations; /applications; /messaging; /dashboard | features/invitations/actions.ts:74 decideInvitationAction | api.post `/job-invitations/${id}/accept` | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 091 | /job-invitations; /applications; /messaging; /dashboard | features/invitations/actions.ts:79 decideInvitationAction | api.post `/job-invitations/${id}/${decision}` | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 092 | /job-invitations; /applications; /messaging; /dashboard | features/invitations/queries.ts:15 listInvitations | api.get "/job-invitations/me" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 093 | /job-invitations; /applications; /messaging; /dashboard | features/invitations/queries.ts:20 getInvitation | api.get `/job-invitations/${id}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 094 | /job-invitations; /applications; /messaging; /dashboard | features/invitations/use-invitations.ts:10 useInvitations | fetchJson "/api/job-invitations/me" | Mount/focus; pending 15–30s; all-pages may loop | All-page polling PF-09 | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 095 | /job-invitations; /applications; /messaging; /dashboard | features/invitations/use-invitations.ts:23 useAllInvitations | fetchJson "/api/job-invitations/me" | Mount/focus; pending 15–30s; all-pages may loop | All-page polling PF-09 | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 096 | /job-invitations; /applications; /messaging; /dashboard | features/invitations/use-invitations.ts:39 useInvitation | fetchJson `/api/job-invitations/${id}` | Mount/focus; pending 15–30s; all-pages may loop | All-page polling PF-09 | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 097 | /dashboard; /find-jobs; /job-detail; /post-job | features/jobs/actions.ts:20 createJobAction | api.post "/jobs" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 098 | /dashboard; /find-jobs; /job-detail; /post-job | features/jobs/actions.ts:23 createJobAction | api.patch `/jobs/${created.id}` | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 099 | /dashboard; /find-jobs; /job-detail; /post-job | features/jobs/actions.ts:64 updateJobAction | api.get `/jobs/mine/${encodeURIComponent(input.id)}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 100 | /dashboard; /find-jobs; /job-detail; /post-job | features/jobs/actions.ts:72 updateJobAction | api.get `/jobs/mine/${encodeURIComponent(input.id)}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 101 | /dashboard; /find-jobs; /job-detail; /post-job | features/jobs/actions.ts:84 updateJobAction | api.patch `/jobs/${normalizedInput.id}` | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 102 | /dashboard; /find-jobs; /job-detail; /post-job | features/jobs/actions.ts:106 deleteJobAction | api.get `/jobs/mine/${encodeURIComponent(id)}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 103 | /dashboard; /find-jobs; /job-detail; /post-job | features/jobs/actions.ts:108 deleteJobAction | api.delete `/jobs/${id}` | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 104 | /dashboard; /find-jobs; /job-detail; /post-job | features/jobs/queries.ts:13 listJobs | api.get "/jobs" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | No persistent server cache proven; inspect explicit hook below | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 105 | /dashboard; /find-jobs; /job-detail; /post-job | features/jobs/queries.ts:24 listMyJobs | api.get "/jobs/mine" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | No persistent server cache proven; inspect explicit hook below | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 106 | /dashboard; /find-jobs; /job-detail; /post-job | features/jobs/queries.ts:34 getJob | api.get `/jobs/${id}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | No persistent server cache proven; inspect explicit hook below | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 107 | /dashboard; /find-jobs; /job-detail; /post-job | features/jobs/queries.ts:48 getMyJob | api.get `/jobs/mine/${encodeURIComponent(id)}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | No persistent server cache proven; inspect explicit hook below | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 108 | /dashboard; /find-jobs; /job-detail; /post-job | features/jobs/queries.ts:62 getAccessibleJob | api.get `/jobs/accessible/${encodeURIComponent(id)}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | No persistent server cache proven; inspect explicit hook below | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 109 | /dashboard; /find-jobs; /job-detail; /post-job | features/jobs/use-jobs.ts:55 useJobs | fetchJson "/api/jobs" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 110 | /dashboard; /find-jobs; /job-detail; /post-job | features/jobs/use-jobs.ts:64 useMyJobs | fetchJson "/api/jobs/mine" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 111 | /dashboard; /find-jobs; /job-detail; /post-job | features/jobs/use-jobs.ts:73 useJob | fetchJson `/api/jobs/${id}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 112 | /find-jobs; /job-detail; /dashboard; /applications | features/matching/queries.ts:16 getRankedApplications | api.get `/matching/jobs/${jobId}/applications` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 113 | /find-jobs; /job-detail; /dashboard; /applications | features/matching/queries.ts:21 getRecommendedInstructors | api.get `/matching/jobs/${jobId}/instructors` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 114 | /find-jobs; /job-detail; /dashboard; /applications | features/matching/queries.ts:26 getRecommendedJobs | api.get "/matching/jobs/recommended" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 115 | /find-jobs; /job-detail; /dashboard; /applications | features/matching/queries.ts:31 getJobMatchScore | api.get `/matching/jobs/${jobId}/score` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 116 | /find-jobs; /job-detail; /dashboard; /applications | features/matching/use-matching.ts:11 useRankedApplications | fetchJson `/api/matching/jobs/${jobId}/applications` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 117 | /find-jobs; /job-detail; /dashboard; /applications | features/matching/use-matching.ts:15 useRecommendedInstructors | fetchJson `/api/matching/jobs/${jobId}/instructors` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 118 | /find-jobs; /job-detail; /dashboard; /applications | features/matching/use-matching.ts:19 useRecommendedJobs | fetchJson "/api/matching/jobs/recommended" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 119 | /find-jobs; /job-detail; /dashboard; /applications | features/matching/use-matching.ts:23 useJobMatchScore | fetchJson `/api/matching/jobs/${jobId}/score` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 120 | /my-profile | features/my-profile/use-my-profile.ts:10 useProfileJobs | fetchJson "/api/jobs/mine" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 121 | /my-profile | features/my-profile/use-my-profile.ts:14 useProfileApplications | fetchJson "/api/my-profile/applications" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 122 | /my-profile | features/my-profile/use-my-profile.ts:18 useProfileReviews | fetchJson "/api/my-profile/reviews" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 123 | Workspace shell; /settings; /dashboard | features/notifications/actions.ts:15 markNotificationReadAction | api.post `/notifications/${id}/read` | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 124 | Workspace shell; /settings; /dashboard | features/notifications/actions.ts:23 markAllNotificationsReadAction | api.post "/notifications/read-all" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 125 | Workspace shell; /settings; /dashboard | features/notifications/actions.ts:35 updateNotificationPreferencesAction | api.patch "/notifications/preferences" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 126 | Workspace shell; /settings; /dashboard | features/notifications/queries.ts:15 listNotifications | api.get "/notifications" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 127 | Workspace shell; /settings; /dashboard | features/notifications/queries.ts:26 getUnreadNotificationCount | api.get "/notifications/unread-count" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 128 | Workspace shell; /settings; /dashboard | features/notifications/queries.ts:31 getNotificationPreferences | api.get "/notifications/preferences" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 129 | Workspace shell; /settings; /dashboard | features/notifications/use-notifications.ts:46 useNotifications | fetchJson "/api/notifications" | Enabled UI; unread60s + realtime | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 130 | Workspace shell; /settings; /dashboard | features/notifications/use-notifications.ts:55 useRecentNotifications | fetchJson "/api/notifications" | Enabled UI; unread60s + realtime | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 131 | Workspace shell; /settings; /dashboard | features/notifications/use-notifications.ts:75 useUnreadNotifications | fetchJson "/api/notifications/unread-count" | Enabled UI; unread60s + realtime | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 132 | Workspace shell; /settings; /dashboard | features/notifications/use-notifications.ts:141 useNotificationPreferences | fetchJson "/api/notifications/preferences" | Enabled UI; unread60s + realtime | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 133 | /onboarding; all workspace shells | features/onboarding/actions.ts:395 getCurrentUserSnapshot | api.get "/users/me" | On consumer request; exact runtime frequency NOT TESTED | Server/client snapshot overlap PF-05 | No persistent server cache proven; inspect explicit hook below | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 134 | /onboarding; all workspace shells | features/onboarding/actions.ts:402 getCurrentInstructorSnapshot | api.get "/instructors/me" | On consumer request; exact runtime frequency NOT TESTED | Server/client snapshot overlap PF-05 | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 135 | /onboarding; all workspace shells | features/onboarding/actions.ts:419 getInstitutionSnapshot | api.get "/institutions/me" | On consumer request; exact runtime frequency NOT TESTED | Server/client snapshot overlap PF-05 | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 136 | /onboarding; all workspace shells | features/onboarding/actions.ts:435 getSignatoryApproval | api.get "/institutions/me/signatory-approval" | On consumer request; exact runtime frequency NOT TESTED | Server/client snapshot overlap PF-05 | Explicit fetch no-store | S — No shared/persistent cache; no TTL for secrets/actions | Session/auth/profile/token lifecycle; never serve expired authorization | Fewer repeated reads where safe; benefit NOT MEASURED | High; authorization/doc state must remain live |
| 137 | /onboarding; all workspace shells | features/onboarding/actions.ts:460 ensureSignatoryApproval | api.post "/institutions/me/signatory-approval" | On explicit action; not executed | Server/client snapshot overlap PF-05 | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 138 | /onboarding; all workspace shells | features/onboarding/actions.ts:512 getOnboardingProfileSnapshot | api.get "/users/me" | On consumer request; exact runtime frequency NOT TESTED | Server/client snapshot overlap PF-05 | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 139 | /onboarding; all workspace shells | features/onboarding/actions.ts:577 getOnboardingAuth | api.get "/users/me" | On consumer request; exact runtime frequency NOT TESTED | Server/client snapshot overlap PF-05 | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 140 | /onboarding; all workspace shells | features/onboarding/actions.ts:597 saveUserBasics | api.get "/users/me" | On consumer request; exact runtime frequency NOT TESTED | Server/client snapshot overlap PF-05 | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 141 | /onboarding; all workspace shells | features/onboarding/actions.ts:622 saveUserBasics | api.patch "/users/me" | On explicit action; not executed | Server/client snapshot overlap PF-05 | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 142 | /onboarding; all workspace shells | features/onboarding/actions.ts:650 saveInstructorProfile | api.patch `/instructors/${existing.id}` | On explicit action; not executed | Server/client snapshot overlap PF-05 | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 143 | /onboarding; all workspace shells | features/onboarding/actions.ts:654 saveInstructorProfile | api.post "/instructors" | On explicit action; not executed | Server/client snapshot overlap PF-05 | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 144 | /onboarding; all workspace shells | features/onboarding/actions.ts:673 saveInstitutionProfile | api.patch `/institutions/${existing.id}` | On explicit action; not executed | Server/client snapshot overlap PF-05 | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 145 | /onboarding; all workspace shells | features/onboarding/actions.ts:677 saveInstitutionProfile | api.post "/institutions" | On explicit action; not executed | Server/client snapshot overlap PF-05 | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 146 | /onboarding; all workspace shells | features/onboarding/actions.ts:694 submitInstructorProfileForReview | api.patch "/instructors/me/status" | On explicit action; not executed | Server/client snapshot overlap PF-05 | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 147 | /onboarding; all workspace shells | features/onboarding/actions.ts:714 submitInstitutionProfileForReview | api.patch "/institutions/me/status" | On explicit action; not executed | Server/client snapshot overlap PF-05 | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 148 | /onboarding; all workspace shells | features/onboarding/actions.ts:777 downloadOnboardingDocumentAction | api.get `/documents/${documentId}/download-url` | On consumer request; exact runtime frequency NOT TESTED | Server/client snapshot overlap PF-05 | No persistent server cache proven; inspect explicit hook below | S — No shared/persistent cache; no TTL for secrets/actions | Session/auth/profile/token lifecycle; never serve expired authorization | Fewer repeated reads where safe; benefit NOT MEASURED | High; authorization/doc state must remain live |
| 149 | /onboarding; all workspace shells | features/onboarding/documents.ts:217 getProfileDocumentRequirements | api.get "/document-requirements/profile" | On consumer request; exact runtime frequency NOT TESTED | Server/client snapshot overlap PF-05 | Explicit fetch no-store | S — No shared/persistent cache; no TTL for secrets/actions | Session/auth/profile/token lifecycle; never serve expired authorization | Fewer repeated reads where safe; benefit NOT MEASURED | High; authorization/doc state must remain live |
| 150 | /onboarding; all workspace shells | features/onboarding/documents.ts:245 listProfileDocuments | api.get "/documents" | On consumer request; exact runtime frequency NOT TESTED | Server/client snapshot overlap PF-05 | Explicit fetch no-store | S — No shared/persistent cache; no TTL for secrets/actions | Session/auth/profile/token lifecycle; never serve expired authorization | Fewer repeated reads where safe; benefit NOT MEASURED | High; authorization/doc state must remain live |
| 151 | /onboarding; all workspace shells | features/onboarding/documents.ts:340 createDocument | api.post "/documents" | On explicit action; not executed | Server/client snapshot overlap PF-05 | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 152 | /onboarding; all workspace shells | features/onboarding/documents.ts:366 uploadProfileDocument | api.post `/documents/${documentId}/upload-url` | On explicit action; not executed | Server/client snapshot overlap PF-05 | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 153 | /onboarding; all workspace shells | features/onboarding/documents.ts:379 uploadProfileDocument | fetch uploadUrl | On explicit action; not executed | Server/client snapshot overlap PF-05 | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 154 | /onboarding; all workspace shells | features/onboarding/documents.ts:390 uploadProfileDocument | api.post `/documents/${documentId}/upload-complete` | On explicit action; not executed | Server/client snapshot overlap PF-05 | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |
| 155 | /onboarding; all workspace shells | features/onboarding/use-onboarding.ts:14 useOnboardingSnapshot | fetchJson "/api/onboarding/me" | Mount/focus + 60s | Server/client snapshot overlap PF-05 | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 156 | /onboarding; all workspace shells | features/onboarding/use-onboarding.ts:33 useOnboardingDocumentRequirements | fetchJson "/api/onboarding/document-requirements" | Mount/focus + 60s | Server/client snapshot overlap PF-05 | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 157 | /billing; /bookings; /settings; /payouts/* | features/payments/actions.ts:19 createPayoutSessionAction | api.post "/payments/payout-account/session" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 158 | /billing; /bookings; /settings; /payouts/* | features/payments/actions.ts:36 createInvoicePaymentSessionAction | api.post `/invoices/${invoiceId}/payment-session` | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 159 | /billing; /bookings; /settings; /payouts/* | features/payments/actions.ts:60 syncInvoiceAction | api.post `/invoices/${invoiceId}/sync` | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 160 | /billing; /bookings; /settings; /payouts/* | features/payments/actions.ts:76 instantPayoutAction | api.post "/payments/payout-account/instant-payout" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 161 | /billing; /bookings; /settings; /payouts/* | features/payments/actions.ts:100 createInvoiceAction | api.post "/invoices" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 162 | /billing; /bookings; /settings; /payouts/* | features/payments/actions.ts:133 refundInvoiceAction | api.post `/invoices/${id}/refund` | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 163 | /billing; /bookings; /settings; /payouts/* | features/payments/actions.ts:149 invoiceCommand | api.post `/invoices/${invoiceId}/${command}` | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 164 | /billing; /bookings; /settings; /payouts/* | features/payments/admin-payout-queries.ts:19 getInstructorPayoutAccount | api.get `/payments/payout-accounts/instructor/${encodeURIComponent(instructorId)}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 165 | /billing; /bookings; /settings; /payouts/* | features/payments/queries.ts:38 getMyPayoutAccount | api.get "/payments/payout-account" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 166 | /billing; /bookings; /settings; /payouts/* | features/payments/queries.ts:45 getMyPayoutBalance | api.get "/payments/payout-account/balance" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 167 | /billing; /bookings; /settings; /payouts/* | features/payments/queries.ts:53 listMyInvoices | api.get "/invoices/me" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 168 | /billing; /bookings; /settings; /payouts/* | features/payments/queries.ts:66 listAllInvoices | api.get "/invoices" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 169 | /billing; /bookings; /settings; /payouts/* | features/payments/queries.ts:76 getInvoice | api.get `/invoices/${encodeURIComponent(id)}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 170 | /billing; /bookings; /settings; /payouts/* | features/payments/use-payments.ts:37 usePayoutAccount | fetchJson "/api/payments/payout-account" | Mount; hooks may poll 5/15s | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 171 | /billing; /bookings; /settings; /payouts/* | features/payments/use-payments.ts:46 usePayoutBalance | fetchJson "/api/payments/payout-account/balance" | Mount; hooks may poll 5/15s | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 172 | /billing; /bookings; /settings; /payouts/* | features/payments/use-payments.ts:69 useMyInvoices | fetchJson "/api/invoices/me" | Mount; hooks may poll 5/15s | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 173 | /billing; /bookings; /settings; /payouts/* | features/payments/use-payments.ts:80 useAllInvoices | fetchJson "/api/invoices" | Mount; hooks may poll 5/15s | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 174 | /billing; /bookings; /settings; /payouts/* | features/payments/use-payments.ts:91 useInvoice | fetchJson `/api/invoices/${encodeURIComponent(id ?? "")}` | Mount; hooks may poll 5/15s | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 175 | /teacher-profile; /institution-profile | features/public-profiles/queries.ts:10 getInstructorPublicProfile | api.get `/instructors/profile/${encodeURIComponent(id)}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 176 | /teacher-profile; /institution-profile | features/public-profiles/queries.ts:16 getInstitutionPublicProfile | api.get `/institutions/profile/${encodeURIComponent(id)}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 177 | /teacher-profile; /institution-profile | features/public-profiles/use-public-profiles.ts:13 useInstructorPublicProfile | fetchJson `/api/instructors/profile/${id}` | Mount; instructor focus/30s | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 178 | /teacher-profile; /institution-profile | features/public-profiles/use-public-profiles.ts:25 useInstitutionPublicProfile | fetchJson `/api/institutions/profile/${id}` | Mount; instructor focus/30s | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 179 | /teacher-profile; /institution-profile | features/reviews/queries.ts:22 listInstructorReviews | api.get `/reviews/instructor/${encodeURIComponent(instructorId)}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 180 | /teacher-profile; /institution-profile | features/reviews/queries.ts:33 listInstitutionReviews | api.get `/reviews/institution/${encodeURIComponent(institutionId)}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 181 | /teacher-profile; /institution-profile | features/reviews/use-reviews.ts:15 useInstructorReviews | fetchJson `/api/reviews/instructor/${encodeURIComponent(id)}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 182 | /teacher-profile; /institution-profile | features/reviews/use-reviews.ts:25 useInstitutionReviews | fetchJson `/api/reviews/institution/${encodeURIComponent(id)}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 183 | /settings; /security; /dashboard | features/settings/actions.ts:243 uploadSettingsProfileImageAction | api.post "/users/me/profile-image/upload-url" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 184 | /settings; /security; /dashboard | features/settings/actions.ts:254 uploadSettingsProfileImageAction | fetch uploadUrl | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 185 | /settings; /security; /dashboard | features/settings/actions.ts:265 uploadSettingsProfileImageAction | api.post "/users/me/profile-image/upload-complete" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 186 | /settings; /security; /dashboard | features/settings/actions.ts:327 updateSettingsAction | api.patch "/users/me" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 187 | /settings; /security; /dashboard | features/settings/actions.ts:334 updateSettingsAction | api.patch `/instructors/${profileId}` | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 188 | /settings; /security; /dashboard | features/settings/actions.ts:341 updateSettingsAction | api.patch `/institutions/${profileId}` | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 189 | /settings; /security; /dashboard | features/settings/queries.ts:205 optionalApiGet | api.get path | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | No persistent server cache proven; inspect explicit hook below | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 190 | /settings; /security; /dashboard | features/settings/queries.ts:252 getSettingsProfileSnapshot | api.get "/users/me" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 191 | /settings; /security; /dashboard | features/settings/use-settings.ts:50 useSettingsProfile | fetchJson "/api/settings/profile" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 192 | /find-teachers; /teacher-profile | features/teachers/actions.ts:26 updateTeacherProfileAction | api.patch "/teachers/me" | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | User records can become outdated; never shared-cache |
| 193 | /find-teachers; /teacher-profile | features/teachers/queries.ts:22 listTeachers | api.get "/teachers" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | No persistent server cache proven; inspect explicit hook below | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 194 | /find-teachers; /teacher-profile | features/teachers/queries.ts:45 listTeacherDirectory | api.get "/instructors/directory" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | Explicit fetch no-store | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 195 | /find-teachers; /teacher-profile | features/teachers/queries.ts:72 getTeacher | api.get `/teachers/${id}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | No persistent server cache proven; inspect explicit hook below | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 196 | /find-teachers; /teacher-profile | features/teachers/use-teachers.ts:12 useTeachers | fetchJson "/api/teachers" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 197 | /find-teachers; /teacher-profile | features/teachers/use-teachers.ts:19 useTeacherDirectory | fetchJson "/api/instructors/directory" | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 198 | /find-teachers; /teacher-profile | features/teachers/use-teachers.ts:31 useTeacher | fetchJson `/api/teachers/${id}` | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | TanStack if called by hook; helper itself uncached | Q — Private in-memory30s baseline; retain stricter money/compliance overrides | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 199 | Shared wrapper / importing consumers | lib/query/fetch-json.ts:32 fetchJson | fetch withQuery(path, options.query) | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | No persistent server cache proven; inspect explicit hook below | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 200 | Shared wrapper / importing consumers | lib/server/api-client.ts:177 request | fetch url | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | No persistent server cache proven; inspect explicit hook below | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 201 | Shared wrapper / importing consumers | lib/server/api-client.ts:184 request | fetch url | On consumer request; exact runtime frequency NOT TESTED | Not measured per call; identical Query keys dedupe in one provider | No persistent server cache proven; inspect explicit hook below | D — Prefer request-scoped dedupe; private30s only if freshness permits | Owning entity mutation, socket notification, logout/account change | Fewer repeated reads where safe; benefit NOT MEASURED | User records can become outdated; never shared-cache |
| 202 | Shared wrapper / importing consumers | lib/server/token-refresh.ts:149 requestTokenRefresh | fetch url | On explicit action; not executed | Not measured per call; identical Query keys dedupe in one provider | No read cache | M — No shared/persistent cache; no TTL for secrets/actions | Invalidate owning query families on success; preserve idempotency | Correctness only; no speed estimate | High; authorization/doc state must remain live |

### Exact query/mutation definitions and overrides

The source text below is included for precise request-key, polling and invalidation review. A hook being present does not mean every branch ran during this audit.

<details><summary>components/organisms/AdminPayoutLookup.tsx:17 — AdminPayoutLookup (useQuery)</summary>

```tsx
useQuery({
    enabled: Boolean(instructorId),
    queryFn: () => fetchJson<PayoutAccount>(`/api/payments/payout-accounts/instructor/${encodeURIComponent(instructorId)}`),
    queryKey: [...queryKeys.payments.all, "instructor-payout-account", instructorId],
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    staleTime: 0,
  })
```

</details>

<details><summary>components/organisms/PayInvoiceModal.tsx:41 — PaymentSession (useQuery)</summary>

```tsx
useQuery({
    gcTime: 0,
    queryFn: async () => unwrapActionResult(await createInvoicePaymentSessionAction(invoice.id)),
    queryKey: ["invoice-payment-session", invoice.id],
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: Infinity,
  })
```

</details>

<details><summary>features/applications/use-applications.ts:22 — useJobApplications (useQuery)</summary>

```tsx
useQuery({
    enabled: Boolean(jobId),
    queryFn: () => fetchJson<PaginatedApplications>(`/api/applications/job/${jobId}`, { query }),
    queryKey: queryKeys.applications.byJob(jobId ?? "", query),
  })
```

</details>

<details><summary>features/applications/use-applications.ts:30 — useApplication (useQuery)</summary>

```tsx
useQuery({
    enabled: Boolean(applicationId),
    queryFn: () => fetchJson<JobApplication>(`/api/applications/${applicationId}`),
    queryKey: queryKeys.applications.detail(applicationId ?? ""),
  })
```

</details>

<details><summary>features/applications/use-applications.ts:38 — useApplicationHistory (useQuery)</summary>

```tsx
useQuery({
    enabled: Boolean(applicationId),
    queryFn: () => fetchJson<PaginatedApplicationHistory>(`/api/applications/${applicationId}/history`, { query: { page, limit } }),
    queryKey: [...queryKeys.applications.history(applicationId ?? ""), { page, limit }],
  })
```

</details>

<details><summary>features/applications/use-applications.ts:46 — useMyApplications (useQuery)</summary>

```tsx
useQuery({
    enabled,
    queryFn: () => fetchJson<PaginatedApplications>("/api/applications/me", { query }),
    queryKey: queryKeys.applications.mine(query),
  })
```

</details>

<details><summary>features/applications/use-applications.ts:54 — useActiveJobApplicantCount (useQuery)</summary>

```tsx
useQuery({
    queryFn: () => fetchJson<{ total: number }>("/api/applications/active-jobs/count"),
    queryKey: queryKeys.applications.activeJobCount(),
  })
```

</details>

<details><summary>features/applications/use-applications.ts:62 — useUpdateApplicationStatus (useMutation)</summary>

```tsx
useMutation({
    mutationFn: (input: ApplicationStatusUpdateInput) => updateApplicationStatusAction(input),
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok || result.status === 409 || result.status === 400 || result.code === "SCHOOL_INACTIVE") {
        await refreshMarketplace(queryClient);
        if (result.ok && result.data.status === "HIRED") await queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      }
      await options.onSuccess?.(result);
    },
  })
```

</details>

<details><summary>features/applications/use-applications.ts:78 — useCreateApplication (useMutation)</summary>

```tsx
useMutation({
    mutationFn: (input: ApplicationCreateInput) => createApplicationAction(input),
    onError: options.onError,
    onSuccess: async (result) => {
      if (!result.ok && result.code === "SESSION_EXPIRED") {
        startRouteLoading();
        void signOut({ redirect: false }).finally(() => {
          window.location.assign("/login");
        });
        return;
      }

      if (result.ok || result.code === "JOB_RESERVED" || result.code === "JOB_UNAVAILABLE") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.applications.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.matching.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
        ]);
      }

      await options.onSuccess?.(result);
    },
  })
```

</details>

<details><summary>features/auth/use-current-user.ts:11 — useCurrentUser (useQuery)</summary>

```tsx
useQuery({
    queryFn: () => fetchJson<AuthUser | null>("/api/auth/me"),
    queryKey: queryKeys.auth.me(),
  })
```

</details>

<details><summary>features/auth/use-phone-verification.ts:25 — useSendPhoneOtp (useMutation)</summary>

```tsx
useMutation({
    mutationFn: (input: { phone: string }): Promise<Awaited<ReturnType<typeof sendPhoneOtpAction>>> => {
      const phone = validateUkPhone(input.phone, { required: true });
      if (!phone.valid) return Promise.resolve({ ok: false as const, message: phone.error!, fieldErrors: { phone: phone.error! } });
      return sendPhoneOtpAction({ phone: phone.value });
    },
    mutationKey: [...queryKeys.auth.all, "phone", "send"],
    onSuccess: (result) => handleExpiredSession(result, () => router.replace("/login")),
  })
```

</details>

<details><summary>features/auth/use-phone-verification.ts:40 — useVerifyPhoneOtp (useMutation)</summary>

```tsx
useMutation({
    mutationFn: (input: { otp: string }): Promise<Awaited<ReturnType<typeof verifyPhoneOtpAction>>> => {
      if (!validateOtpCode(input.otp)) return Promise.resolve({ ok: false as const, message: "Enter the 6-digit code from your SMS.", fieldErrors: { otp: "Enter the 6-digit code from your SMS." } });
      return verifyPhoneOtpAction({ otp: input.otp.trim() });
    },
    mutationKey: [...queryKeys.auth.all, "phone", "verify"],
    onSuccess: async (result) => {
      handleExpiredSession(result, () => router.replace("/login"));
      if (!result.ok) return;

      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.auth.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.settings.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.onboarding.all }),
      ]);
      const phone = { phone: result.data.phone, phoneVerified: result.data.phoneVerified };
      queryClient.setQueryData<AuthUser | null>(queryKeys.auth.me(), (current) => current ? { ...current, ...phone } : current);
      queryClient.setQueryData<SettingsProfileSnapshot>(queryKeys.settings.profile(), (current) =>
        current ? { ...current, user: { ...current.user, ...phone } } : current,
      );
      queryClient.setQueriesData<OnboardingProfileSnapshot>({ queryKey: queryKeys.onboarding.all }, (current) =>
        current?.user ? { ...current, user: { ...current.user, ...phone } } : current,
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all }),
      ]);
    },
  })
```

</details>

<details><summary>features/bookings/use-bookings.ts:12 — useBooking (useQuery)</summary>

```tsx
useQuery({ enabled: Boolean(id), queryKey: queryKeys.bookings.detail(id ?? ""), queryFn: () => fetchJson<Booking>(`/api/bookings/${id}`), refetchOnMount: "always" })
```

</details>

<details><summary>features/bookings/use-bookings.ts:24 — useBookings (useQuery)</summary>

```tsx
useQuery({
    enabled,
    queryFn: () => fetchJson<PaginatedBookings>("/api/bookings/me", { query }),
    queryKey: queryKeys.bookings.mine(query),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: (current) => current.state.data?.bookings.some((booking) => booking.invoice?.status === "OPEN" || booking.invoice?.status === "UNCOLLECTIBLE") ? 15_000 : false,
  })
```

</details>

<details><summary>features/bookings/use-bookings.ts:37 — useUpdateBookingStatus (useMutation)</summary>

```tsx
useMutation({
    mutationFn: (input: BookingStatusUpdateInput) => updateBookingStatusAction(input),
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok) await Promise.all(
        [queryKeys.bookings.all, queryKeys.teachers.all, queryKeys.publicProfiles.all]
          .map(queryKey => queryClient.invalidateQueries({ queryKey })),
      );
      await options.onSuccess?.(result);
    },
  })
```

</details>

<details><summary>features/bookings/use-bookings.ts:53 — useCreateBookingReview (useMutation)</summary>

```tsx
useMutation({
    mutationFn: (input: BookingReviewInput) => createBookingReviewAction(input),
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok) await queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
      await options.onSuccess?.(result);
    },
  })
```

</details>

<details><summary>features/conversations/use-conversations.ts:43 — useConversations (useInfiniteQuery)</summary>

```tsx
useInfiniteQuery({
    enabled: options.enabled ?? true,
    getNextPageParam: (page: ConversationsPage) => (page.pagination.hasNextPage ? page.pagination.page + 1 : undefined),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchJson<ConversationsPage>("/api/conversations", { query: { page: pageParam, limit } }),
    queryKey: limit === 100 ? queryKeys.conversations.list() : [...queryKeys.conversations.list(), { limit }],
    // New application/booking threads may be empty and therefore emit no message event.
    refetchInterval: FALLBACK_REFETCH_MS,
  })
```

</details>

<details><summary>features/conversations/use-conversations.ts:56 — useConversationThreads (useInfiniteQuery)</summary>

```tsx
useInfiniteQuery({
    queryKey: [...queryKeys.conversations.list(), "threads", conversation.participants.poster?.userId ?? conversation.participants.poster?.id, conversation.participants.instructor?.id, topic],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchJson<ConversationThreadsPage>(`/api/conversations/${conversation.id}/threads`, { query: { topic, before: pageParam, limit: 20 } }),
    getNextPageParam: page => page.hasMore ? page.nextCursor ?? undefined : undefined,
    staleTime: 30_000,
  })
```

</details>

<details><summary>features/conversations/use-conversations.ts:81 — useUnreadMessages (useQuery)</summary>

```tsx
useQuery({
    enabled: options.enabled ?? true,
    queryFn: () => fetchJson<{ total: number }>("/api/conversations/unread-count"),
    queryKey: queryKeys.conversations.unread(),
    refetchInterval: 60_000,
  })
```

</details>

<details><summary>features/conversations/use-conversations.ts:91 — useConversationForApplication (useQuery)</summary>

```tsx
useQuery({
    enabled: Boolean(applicationId),
    queryFn: async () => {
      const result = await openConversationForApplicationAction(applicationId as string);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    queryKey: queryKeys.conversations.forApplication(applicationId ?? ""),
  })
```

</details>

<details><summary>features/conversations/use-conversations.ts:103 — useConversationForBooking (useQuery)</summary>

```tsx
useQuery({
    enabled: Boolean(bookingId),
    queryFn: async () => {
      const result = await openConversationForBookingAction(bookingId as string);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    queryKey: queryKeys.conversations.forBooking(bookingId ?? ""),
  })
```

</details>

<details><summary>features/conversations/use-conversations.ts:115 — useConversation (useQuery)</summary>

```tsx
useQuery({ enabled: Boolean(id), queryKey: queryKeys.conversations.detail(id ?? ""), queryFn: () => fetchJson<Conversation>(`/api/conversations/${id}`) })
```

</details>

<details><summary>features/conversations/use-conversations.ts:120 — useStartConversation (useMutation)</summary>

```tsx
useMutation({
    mutationFn: async (input: StartConversationInput) => {
      const result = await startConversationAction(input);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (conversation) => {
      client.setQueryData(queryKeys.conversations.detail(conversation.id), conversation);
      void client.invalidateQueries({ queryKey: queryKeys.conversations.list() });
    },
  })
```

</details>

<details><summary>features/conversations/use-conversations.ts:136 — useMessages (useInfiniteQuery)</summary>

```tsx
useInfiniteQuery({
    enabled: Boolean(conversationId),
    getNextPageParam: (page: MessagesPage) => (page.hasMore ? page.messages[0]?.id : undefined),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      fetchJson<MessagesPage>(`/api/conversations/${conversationId}/messages`, { query: { before: pageParam } }),
    queryKey: queryKeys.conversations.messages(conversationId ?? ""),
    refetchInterval: connected ? false : FALLBACK_REFETCH_MS,
  })
```

</details>

<details><summary>features/conversations/use-conversations.ts:179 — useSendMessage (useMutation)</summary>

```tsx
useMutation({
    mutationFn: async (input: SendMessageInput) => {
      const result = await sendMessageAction(input);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onError: (error) => options.onError?.(error.message),
    onSuccess: async (message) => {
      if (!appendMessage(queryClient, message)) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.conversations.messages(message.conversationId) });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list() });
    },
  })
```

</details>

<details><summary>features/conversations/use-conversations.ts:198 — useMarkConversationRead (useMutation)</summary>

```tsx
useMutation({
    mutationFn: (conversationId: string) => markConversationReadAction(conversationId),
    onSuccess: async (result, conversationId) => {
      if (!result.ok) return;
      patchConversation(queryClient, conversationId, (item) => ({ ...item, unreadCount: 0 }));
      await queryClient.invalidateQueries({ queryKey: queryKeys.conversations.unread() });
    },
  })
```

</details>

<details><summary>features/conversations/use-conversations.ts:290 — useTypingIndicator (useQuery)</summary>

```tsx
useQuery<TypingState | null>({
    enabled: false,
    queryFn: () => null,
    queryKey: queryKeys.conversations.typing(conversationId ?? ""),
    staleTime: Infinity,
  })
```

</details>

<details><summary>features/dashboard/use-teacher-dashboard.ts:32 — useTeacherDashboard (useQuery)</summary>

```tsx
useQuery({
    queryKey: [...queryKeys.bookings.all, "teacher-dashboard", from],
    queryFn: async () => ({ bookings: await loadDashboardPages(async (pagination) => {
      const result = await fetchJson<PaginatedBookings>("/api/bookings/me", { query: { ...pagination, from, status: "CONFIRMED" } });
      return { items: result.bookings, pagination: result.pagination };
    }) }),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    staleTime: 30_000,
    retry: 1,
  })
```

</details>

<details><summary>features/dashboard/use-teacher-dashboard.ts:43 — useTeacherDashboard (useQuery)</summary>

```tsx
useQuery({
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
  })
```

</details>

<details><summary>features/dashboard/use-teacher-dashboard.ts:57 — useTeacherDashboard (useQuery)</summary>

```tsx
useQuery({
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
  })
```

</details>

<details><summary>features/dropdowns/use-dropdown.ts:8 — useDropdown (useQuery)</summary>

```tsx
useQuery({ queryKey: dropdownKey(name), queryFn: () => fetchJson<Dropdown>(`/api/dropdowns/${name}`), staleTime: 30_000, gcTime: 300_000, refetchOnWindowFocus: "always", retry: 1 })
```

</details>

<details><summary>features/invitations/use-invitations.ts:10 — useInvitations (useQuery)</summary>

```tsx
useQuery({ enabled, queryKey: queryKeys.invitations.list(query), queryFn: () => fetchJson<InvitationsPage>("/api/job-invitations/me", { query }), refetchOnMount: "always", refetchOnWindowFocus: "always", refetchInterval: current => current.state.data?.invitations.some(item => item.status === "PENDING") || query.status === "PENDING" ? 30000 : false, refetchIntervalInBackground: false })
```

</details>

<details><summary>features/invitations/use-invitations.ts:15 — useAllInvitations (useQuery)</summary>

```tsx
useQuery({
    enabled,
    queryKey: [...queryKeys.invitations.all, "all-pages"],
    queryFn: async () => {
      const invitations: Invitation[] = [];
      const seen = new Set<string>();
      let page = 1;
      while (true) {
        const result = await fetchJson<InvitationsPage>("/api/job-invitations/me", { query: { limit: 100, page } });
        for (const invitation of result.invitations) {
          if (!seen.has(invitation.id)) { seen.add(invitation.id); invitations.push(invitation); }
        }
        if (!result.pagination.hasNextPage) return invitations;
        if (page >= result.pagination.totalPages || page >= 1000) throw new Error("Invitation pages could not be completed.");
        page += 1;
      }
    },
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: current => current.state.data?.some(item => item.status === "PENDING") ? 30000 : false,
    refetchIntervalInBackground: false,
  })
```

</details>

<details><summary>features/invitations/use-invitations.ts:39 — useInvitation (useQuery)</summary>

```tsx
useQuery({ enabled: enabled && Boolean(id), queryKey: queryKeys.invitations.detail(id ?? ""), queryFn: () => fetchJson<Invitation>(`/api/job-invitations/${id}`), refetchOnMount: "always", refetchOnWindowFocus: "always", refetchInterval: query => query.state.data?.status === "PENDING" ? 15000 : false, refetchIntervalInBackground: false, retry: false })
```

</details>

<details><summary>features/jobs/use-jobs.ts:53 — useJobs (useQuery)</summary>

```tsx
useQuery({
    placeholderData: keepPreviousData,
    queryFn: () => fetchJson<PaginatedJobs>("/api/jobs", { query: filters }),
    queryKey: queryKeys.jobs.list(filters),
  })
```

</details>

<details><summary>features/jobs/use-jobs.ts:62 — useMyJobs (useQuery)</summary>

```tsx
useQuery({
    placeholderData: keepPreviousData,
    queryFn: () => fetchJson<MyJobs>("/api/jobs/mine", { query: filters }),
    queryKey: queryKeys.jobs.mine(filters),
  })
```

</details>

<details><summary>features/jobs/use-jobs.ts:71 — useJob (useQuery)</summary>

```tsx
useQuery({
    enabled: Boolean(id),
    queryFn: () => fetchJson<Job>(`/api/jobs/${id}`, scope === "public" ? undefined : { query: { scope } }),
    queryKey: [...queryKeys.jobs.detail(id), scope],
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: query => ["ACTIVE", "RESERVED"].includes(query.state.data?.status ?? "") ? 30000 : false,
  })
```

</details>

<details><summary>features/jobs/use-jobs.ts:84 — useCreateJob (useMutation)</summary>

```tsx
useMutation({
    mutationFn: (input: JobCreateInput) => createJobAction(input),
    onError: options.onError,
    onSuccess: async (result) => {
      if (!result.ok && catalogueError(result.code)) void queryClient.invalidateQueries({ queryKey: teachingCatalogueKey });
      if (handleSessionExpiredResult(result)) return;

      if (result.ok || result.savedJobId) {
        await refreshMarketplace(queryClient);
      }

      await options.onSuccess?.(result);
    },
  })
```

</details>

<details><summary>features/jobs/use-jobs.ts:103 — useUpdateJob (useMutation)</summary>

```tsx
useMutation({
    mutationFn: (input: JobUpdateInput) => updateJobAction(input),
    onError: options.onError,
    onSuccess: async (result) => {
      if (!result.ok && catalogueError(result.code)) void queryClient.invalidateQueries({ queryKey: teachingCatalogueKey });
      if (handleSessionExpiredResult(result)) return;

      if (result.ok || result.status === 409 || result.code === "SCHOOL_INACTIVE") {
        await refreshMarketplace(queryClient);
      }

      await options.onSuccess?.(result);
    },
  })
```

</details>

<details><summary>features/jobs/use-jobs.ts:122 — useDeleteJob (useMutation)</summary>

```tsx
useMutation({
    mutationFn: (id: string) => deleteJobAction(id),
    onError: options.onError,
    onSuccess: async (result) => {
      if (!result.ok && catalogueError(result.code)) void queryClient.invalidateQueries({ queryKey: teachingCatalogueKey });
      if (handleSessionExpiredResult(result)) return;

      if (result.ok || result.status === 409 || result.code === "SCHOOL_INACTIVE") {
        await refreshMarketplace(queryClient);
      }

      await options.onSuccess?.(result);
    },
  })
```

</details>

<details><summary>features/matching/use-matching.ts:11 — useRankedApplications (useQuery)</summary>

```tsx
useQuery({ enabled: Boolean(jobId), queryFn: () => fetchJson<RankedApplicationsPage>(`/api/matching/jobs/${jobId}/applications`, { query }), queryKey: queryKeys.matching.applications(jobId ?? "", query) })
```

</details>

<details><summary>features/matching/use-matching.ts:15 — useRecommendedInstructors (useQuery)</summary>

```tsx
useQuery({ enabled: Boolean(jobId), queryFn: () => fetchJson<RecommendedInstructorsPage>(`/api/matching/jobs/${jobId}/instructors`, { query }), queryKey: queryKeys.matching.instructors(jobId ?? "", query) })
```

</details>

<details><summary>features/matching/use-matching.ts:19 — useRecommendedJobs (useQuery)</summary>

```tsx
useQuery({ enabled, queryFn: () => fetchJson<RecommendedJobsPage>("/api/matching/jobs/recommended", { query }), queryKey: queryKeys.matching.recommendedJobs(query) })
```

</details>

<details><summary>features/matching/use-matching.ts:23 — useJobMatchScore (useQuery)</summary>

```tsx
useQuery({ enabled: enabled && Boolean(jobId), queryFn: () => fetchJson<MatchResult>(`/api/matching/jobs/${jobId}/score`), queryKey: queryKeys.matching.score(jobId), retry: false })
```

</details>

<details><summary>features/my-profile/use-my-profile.ts:10 — useProfileJobs (useQuery)</summary>

```tsx
useQuery({ enabled, placeholderData: keepPreviousData, queryKey: queryKeys.jobs.mine(query), queryFn: () => fetchJson<MyJobs>("/api/jobs/mine", { query }) })
```

</details>

<details><summary>features/my-profile/use-my-profile.ts:14 — useProfileApplications (useQuery)</summary>

```tsx
useQuery({ placeholderData: keepPreviousData, refetchOnMount: "always", queryKey: [...queryKeys.applications.all, "my-profile", query], queryFn: () => fetchJson<ProfileApplications>("/api/my-profile/applications", { query }) })
```

</details>

<details><summary>features/my-profile/use-my-profile.ts:18 — useProfileReviews (useQuery)</summary>

```tsx
useQuery({ refetchOnMount: "always", queryKey: [...queryKeys.bookings.all, "my-profile-reviews", query], queryFn: () => fetchJson<MyProfileReviews>("/api/my-profile/reviews", { query }) })
```

</details>

<details><summary>features/notifications/use-notifications.ts:42 — useNotifications (useInfiniteQuery)</summary>

```tsx
useInfiniteQuery({
    enabled,
    getNextPageParam: (page: NotificationsPage) => (page.pagination.hasNextPage ? page.pagination.page + 1 : undefined),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchJson<NotificationsPage>("/api/notifications", { query: { limit: PAGE_SIZE, page: pageParam } }),
    queryKey: queryKeys.notifications.list(),
  })
```

</details>

<details><summary>features/notifications/use-notifications.ts:53 — useRecentNotifications (useQuery)</summary>

```tsx
useQuery({
    enabled,
    queryFn: () => fetchJson<NotificationsPage>("/api/notifications", { query: { limit, page: 1 } }),
    queryKey: queryKeys.notifications.recent(limit),
  })
```

</details>

<details><summary>features/notifications/use-notifications.ts:73 — useUnreadNotifications (useQuery)</summary>

```tsx
useQuery({
    enabled,
    queryFn: () => fetchJson<{ total: number }>("/api/notifications/unread-count"),
    queryKey: queryKeys.notifications.unread(),
    refetchInterval: 60_000,
  })
```

</details>

<details><summary>features/notifications/use-notifications.ts:100 — useMarkNotificationRead (useMutation)</summary>

```tsx
useMutation({
    mutationFn: async (notification: AppNotification) => {
      const result = await markNotificationReadAction(notification.id);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    // Shown as read straight away; the server's own count follows over the socket.
    onMutate: (notification) => {
      if (notification.readAt) return;
      const readAt = new Date().toISOString();
      patchList(queryClient, (item) => (item.id === notification.id ? { ...item, readAt } : item));
      patchRecent(queryClient, (item) => (item.id === notification.id ? { ...item, readAt } : item));
      const current = queryClient.getQueryData<{ total: number }>(queryKeys.notifications.unread());
      if (current) setUnread(queryClient, current.total - 1);
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  })
```

</details>

<details><summary>features/notifications/use-notifications.ts:122 — useMarkAllNotificationsRead (useMutation)</summary>

```tsx
useMutation({
    mutationFn: async () => {
      const result = await markAllNotificationsReadAction();
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onMutate: () => {
      const readAt = new Date().toISOString();
      patchList(queryClient, (item) => (item.readAt ? item : { ...item, readAt }));
      patchRecent(queryClient, (item) => (item.readAt ? item : { ...item, readAt }));
      setUnread(queryClient, 0);
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  })
```

</details>

<details><summary>features/notifications/use-notifications.ts:139 — useNotificationPreferences (useQuery)</summary>

```tsx
useQuery({
    enabled,
    queryFn: () => fetchJson<NotificationPreferences>("/api/notifications/preferences"),
    queryKey: queryKeys.notifications.preferences(),
  })
```

</details>

<details><summary>features/notifications/use-notifications.ts:149 — useUpdateNotificationPreferences (useMutation)</summary>

```tsx
useMutation({
    mutationFn: (input: Partial<NotificationPreferences>) => updateNotificationPreferencesAction(input),
    onSuccess: (result) => {
      if (result.ok) queryClient.setQueryData(queryKeys.notifications.preferences(), result.data);
      options.onDone?.(result.ok, result.message);
    },
    onError: () => options.onDone?.(false),
  })
```

</details>

<details><summary>features/onboarding/use-onboarding.ts:12 — useOnboardingSnapshot (useQuery)</summary>

```tsx
useQuery({
    enabled: options.enabled ?? Boolean(accountEmail),
    queryFn: () => fetchJson<OnboardingSnapshot>("/api/onboarding/me"),
    queryKey: [...queryKeys.onboarding.current(), accountEmail],
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    staleTime: 0,
  })
```

</details>

<details><summary>features/onboarding/use-onboarding.ts:30 — useOnboardingDocumentRequirements (useQuery)</summary>

```tsx
useQuery({
    enabled: options.enabled ?? Boolean(role),
    initialData: options.initialData && options.initialData.length > 0 ? options.initialData : undefined,
    queryFn: () => fetchJson<OnboardingDocumentRequirement[]>("/api/onboarding/document-requirements"),
    queryKey: queryKeys.onboarding.documentRequirements(role ?? "none"),
    staleTime: 0,
  })
```

</details>

<details><summary>features/payments/use-payments.ts:35 — usePayoutAccount (useQuery)</summary>

```tsx
useQuery({
    enabled: options.enabled ?? true,
    queryFn: () => fetchJson<PayoutAccount>("/api/payments/payout-account"),
    queryKey: queryKeys.payments.payoutAccount(),
    refetchInterval: (current) => options.pollUntilReady && current.state.data?.connected && !current.state.data.ready ? 5_000 : false,
  })
```

</details>

<details><summary>features/payments/use-payments.ts:44 — usePayoutBalance (useQuery)</summary>

```tsx
useQuery({
    enabled: options.enabled ?? true,
    queryFn: () => fetchJson<PayoutBalance>("/api/payments/payout-account/balance"),
    queryKey: queryKeys.payments.balance(),
  })
```

</details>

<details><summary>features/payments/use-payments.ts:56 — useInstantPayout (useMutation)</summary>

```tsx
useMutation({
    mutationFn: (amountPence?: number) => instantPayoutAction(amountPence),
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok) await queryClient.invalidateQueries({ queryKey: queryKeys.payments.balance() });
      await options.onSuccess?.(result);
    },
  })
```

</details>

<details><summary>features/payments/use-payments.ts:67 — useMyInvoices (useQuery)</summary>

```tsx
useQuery({
    enabled: options.enabled ?? true,
    queryFn: () => fetchJson<PaginatedInvoices>("/api/invoices/me", { query }),
    queryKey: queryKeys.payments.myInvoices(query),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: (current) => current.state.data?.invoices.some((invoice) => invoice.status === "OPEN" || invoice.status === "PAID" || invoice.status === "UNCOLLECTIBLE") ? 15_000 : false,
  })
```

</details>

<details><summary>features/payments/use-payments.ts:78 — useAllInvoices (useQuery)</summary>

```tsx
useQuery({
    enabled: options.enabled ?? true,
    queryFn: () => fetchJson<PaginatedInvoices>("/api/invoices", { query }),
    queryKey: queryKeys.payments.allInvoices(query),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: (current) => current.state.data?.invoices.some((invoice) => invoice.status !== "VOID") ? 15_000 : false,
  })
```

</details>

<details><summary>features/payments/use-payments.ts:89 — useInvoice (useQuery)</summary>

```tsx
useQuery({
    enabled: Boolean(id),
    queryFn: () => fetchJson<Invoice>(`/api/invoices/${encodeURIComponent(id ?? "")}`),
    queryKey: [...queryKeys.payments.all, "invoice", id],
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: (current) => current.state.data && current.state.data.status !== "VOID" ? 15_000 : false,
  })
```

</details>

<details><summary>features/payments/use-payments.ts:102 — useInvoiceMutation (useMutation)</summary>

```tsx
useMutation({
    mutationFn: action,
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.payments.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all }),
        ]);
      }
      await options.onSuccess?.(result);
    },
  })
```

</details>

<details><summary>features/public-profiles/use-public-profiles.ts:11 — useInstructorPublicProfile (useQuery)</summary>

```tsx
useQuery({
    enabled: Boolean(id),
    queryFn: () => fetchJson<InstructorPublicProfile>(`/api/instructors/profile/${id}`),
    queryKey: queryKeys.publicProfiles.instructor(id ?? ""),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })
```

</details>

<details><summary>features/public-profiles/use-public-profiles.ts:23 — useInstitutionPublicProfile (useQuery)</summary>

```tsx
useQuery({
    enabled: Boolean(id),
    queryFn: () => fetchJson<InstitutionPublicProfile>(`/api/institutions/profile/${id}`),
    queryKey: queryKeys.publicProfiles.institution(id ?? ""),
  })
```

</details>

<details><summary>features/reviews/use-reviews.ts:13 — useInstructorReviews (useQuery)</summary>

```tsx
useQuery({
    enabled: Boolean(id),
    queryFn: () => fetchJson<ProfileReviews>(`/api/reviews/instructor/${encodeURIComponent(id)}`),
    queryKey: queryKeys.reviews.instructor(id),
  })
```

</details>

<details><summary>features/reviews/use-reviews.ts:23 — useInstitutionReviews (useQuery)</summary>

```tsx
useQuery({
    enabled: Boolean(id),
    queryFn: () => fetchJson<ProfileReviews>(`/api/reviews/institution/${encodeURIComponent(id)}`),
    queryKey: queryKeys.reviews.institution(id),
  })
```

</details>

<details><summary>features/settings/use-settings.ts:49 — useSettingsProfile (useQuery)</summary>

```tsx
useQuery({
    queryFn: () => fetchJson<SettingsProfileSnapshot>("/api/settings/profile"),
    queryKey: queryKeys.settings.profile(),
  })
```

</details>

<details><summary>features/settings/use-settings.ts:58 — useUpdateSettings (useMutation)</summary>

```tsx
useMutation({
    mutationFn: (input: SettingsUpdateInput) => updateSettingsAction(input),
    onError: options.onError,
    onSuccess: async (result) => {
      if (!result.ok && catalogueError(result.code)) void queryClient.invalidateQueries({ queryKey: teachingCatalogueKey });
      if (!result.ok && result.code === "PHONE_VERIFIED_LOCKED") {
        await queryClient.invalidateQueries({ queryKey: queryKeys.settings.profile() });
      }
      if (!result.ok && result.code === "SESSION_EXPIRED") {
        signOutExpiredSession();
        return;
      }

      if (result.ok) {
        queryClient.setQueryData(queryKeys.settings.profile(), result.data);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.auth.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.settings.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.matching.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.teachers.all }),
        ]);
      }

      await options.onSuccess?.(result);
    },
  })
```

</details>

<details><summary>features/settings/use-settings.ts:89 — useUploadSettingsProfileImage (useMutation)</summary>

```tsx
useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.set("file", file, file.name);
      return uploadSettingsProfileImageAction(formData);
    },
    onError: options.onError,
    onSuccess: async (result) => {
      if (!result.ok && catalogueError(result.code)) void queryClient.invalidateQueries({ queryKey: teachingCatalogueKey });
      if (!result.ok && result.code === "SESSION_EXPIRED") {
        signOutExpiredSession();
        return;
      }

      if (result.ok) {
        queryClient.setQueryData<SettingsProfileSnapshot>(queryKeys.settings.profile(), (current) =>
          current ? snapshotWithProfileImage(current, result.data.imageUrl) : current,
        );
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.auth.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.settings.all }),
        ]);
      }

      await options.onSuccess?.(result);
    },
  })
```

</details>

<details><summary>features/teachers/use-teachers.ts:11 — useTeachers (useQuery)</summary>

```tsx
useQuery({
    queryFn: () => fetchJson<Teacher[]>("/api/teachers", { query: filters }),
    queryKey: queryKeys.teachers.list(filters),
  })
```

</details>

<details><summary>features/teachers/use-teachers.ts:18 — useTeacherDirectory (useQuery)</summary>

```tsx
useQuery({
    queryFn: () => fetchJson<TeacherDirectoryPage>("/api/instructors/directory", { query: filters }),
    queryKey: queryKeys.teachers.directory(filters),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })
```

</details>

<details><summary>features/teachers/use-teachers.ts:29 — useTeacher (useQuery)</summary>

```tsx
useQuery({
    enabled: Boolean(id),
    queryFn: () => fetchJson<Teacher>(`/api/teachers/${id}`),
    queryKey: queryKeys.teachers.detail(id),
  })
```

</details>

### API handler route inventory

| Route | Methods | Source | Explicit Cache-Control in handler? |
| --- | --- | --- | --- |
| /api/applications/active-jobs/count | GET | app/api/applications/active-jobs/count/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/applications/job/[jobId] | GET | app/api/applications/job/[jobId]/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/applications/me | GET | app/api/applications/me/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/applications/[id]/history | GET | app/api/applications/[id]/history/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/applications/[id] | GET | app/api/applications/[id]/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/auth/me | GET | app/api/auth/me/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/auth/[...nextauth] | Exported handler object; see source | app/api/auth/[...nextauth]/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/bookings/me | GET | app/api/bookings/me/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/bookings/[id] | GET | app/api/bookings/[id]/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/conversations | GET | app/api/conversations/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/conversations/socket-ticket | POST | app/api/conversations/socket-ticket/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/conversations/unread-count | GET | app/api/conversations/unread-count/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/conversations/[id]/attachments | POST | app/api/conversations/[id]/attachments/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/conversations/[id]/attachments/[attachmentId]/preview | GET | app/api/conversations/[id]/attachments/[attachmentId]/preview/route.ts | Yes; inspect policy |
| /api/conversations/[id]/messages | GET | app/api/conversations/[id]/messages/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/conversations/[id] | GET | app/api/conversations/[id]/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/conversations/[id]/threads | GET | app/api/conversations/[id]/threads/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/dropdowns | GET | app/api/dropdowns/route.ts | Yes; inspect policy |
| /api/dropdowns/[name] | GET | app/api/dropdowns/[name]/route.ts | Yes; inspect policy |
| /api/health | GET | app/api/health/route.ts | Yes; inspect policy |
| /api/institutions/profile/[id] | GET | app/api/institutions/profile/[id]/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/instructors/directory | GET | app/api/instructors/directory/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/instructors/profile/[id] | GET | app/api/instructors/profile/[id]/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/invoices/me | GET | app/api/invoices/me/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/invoices | GET | app/api/invoices/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/invoices/[id] | GET | app/api/invoices/[id]/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/job-invitations/me | GET | app/api/job-invitations/me/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/job-invitations/[id] | GET | app/api/job-invitations/[id]/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/jobs/mine | GET | app/api/jobs/mine/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/jobs | GET | app/api/jobs/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/jobs/[id] | GET | app/api/jobs/[id]/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/matching/jobs/recommended | GET | app/api/matching/jobs/recommended/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/matching/jobs/[jobId]/applications | GET | app/api/matching/jobs/[jobId]/applications/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/matching/jobs/[jobId]/instructors | GET | app/api/matching/jobs/[jobId]/instructors/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/matching/jobs/[jobId]/score | GET | app/api/matching/jobs/[jobId]/score/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/my-profile/applications | GET | app/api/my-profile/applications/route.ts | Yes; inspect policy |
| /api/my-profile/reviews | GET | app/api/my-profile/reviews/route.ts | Yes; inspect policy |
| /api/notifications/preferences | GET | app/api/notifications/preferences/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/notifications | GET | app/api/notifications/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/notifications/unread-count | GET | app/api/notifications/unread-count/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/onboarding/document-requirements | GET | app/api/onboarding/document-requirements/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/onboarding/documents | POST | app/api/onboarding/documents/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/onboarding/documents/[documentId]/preview | GET | app/api/onboarding/documents/[documentId]/preview/route.ts | Yes; inspect policy |
| /api/onboarding/me | GET | app/api/onboarding/me/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/payments/payout-account/balance | GET | app/api/payments/payout-account/balance/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/payments/payout-account/instant-payout | POST | app/api/payments/payout-account/instant-payout/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/payments/payout-account | GET | app/api/payments/payout-account/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/payments/payout-accounts/instructor/[instructorId] | GET | app/api/payments/payout-accounts/instructor/[instructorId]/route.ts | Yes; inspect policy |
| /api/reviews/institution/[institutionId] | GET | app/api/reviews/institution/[institutionId]/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/reviews/instructor/[instructorId] | GET | app/api/reviews/instructor/[instructorId]/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/settings/profile | GET | app/api/settings/profile/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/signatory-approvals/[token] | GET, POST | app/api/signatory-approvals/[token]/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/teachers | GET | app/api/teachers/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/teachers/[id] | GET | app/api/teachers/[id]/route.ts | Not in handler source (wrapper/deployment may differ) |
| /api/teaching-catalogue | GET | app/api/teaching-catalogue/route.ts | Not in handler source (wrapper/deployment may differ) |

## 11. Every-component inventory and memoization decision

All 133 TSX files were inventoried with imports, hooks, forms and modal sites. The assessment below is a **source pattern scan**, not a claim that every component state was rendered. Dormant/legacy files also remain in scope. Default decision for small components: no new memoization justified by available evidence; do not invent render-duration improvements. No context split is justified by profiling yet.

| Component file | Lines / hooks M,C,R,E | Form / Modal sites | Memo/state-splitting assessment | Browser verification scope |
| --- | --- | --- | --- | --- |
| components/atoms/Avatar.tsx | 84 / 0,0,0,1 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/atoms/Button.tsx | 93 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/atoms/Checkbox.tsx | 42 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/atoms/Chip.tsx | 22 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/atoms/Field.tsx | 80 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/atoms/Icon.tsx | 118 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/atoms/Logo.tsx | 42 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/atoms/MatchScore.tsx | 20 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/atoms/PasswordInput.tsx | 38 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/atoms/Stars.tsx | 9 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/atoms/Stat.tsx | 12 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/atoms/Tag.tsx | 36 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/atoms/Toggle.tsx | 17 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/atoms/VerifyBadge.tsx | 11 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/AgreedTerms.tsx | 23 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/AppAccountMenu.tsx | 203 / 0,0,2,1 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/BookingPaymentNotice.tsx | 21 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/DynamicDropdown.tsx | 30 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/FormattedJobDescription.tsx | 125 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/HourlyWorkSchedule.tsx | 54 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/JobListingPreview.tsx | 173 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/ListPagination.tsx | 25 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/Loaders.tsx | 120 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/MatchScorePanel.tsx | 50 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/Modal.tsx | 97 / 0,0,2,2 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/OptionDropdowns.tsx | 267 / 0,0,6,2 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/PageHead.tsx | 22 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/PasswordFeedback.tsx | 32 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/PhoneInput.tsx | 61 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/PhoneVerification.tsx | 199 / 0,0,0,1 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/PlannedWorkUnitsField.tsx | 19 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/PostcodeLookup.tsx | 158 / 0,0,2,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/ProposalContent.tsx | 105 / 2,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/ProposalEditor.tsx | 341 / 0,1,8,6 | 0 / 0 | Quill already dynamically imported; existing refs/effect cleanup reviewed. Large-editor typing/commit cost NOT TESTED. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/ProposalPreviewModal.tsx | 81 / 0,0,0,0 | 0 / 1 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/PublicAccountMenu.tsx | 201 / 0,0,2,1 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/PublicThemeControls.tsx | 111 / 0,0,2,1 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/RoleDescriptionEditor.tsx | 75 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/RouteErrorState.tsx | 37 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/RouteLoader.tsx | 148 / 0,0,4,2 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/SocialAuthButtons.tsx | 79 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/TagInput.tsx | 70 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/TeacherBookingDates.tsx | 41 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/TeachingSelectionFields.tsx | 86 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/molecules/ToastStack.tsx | 118 / 0,1,2,2 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/AdminDashboard.tsx | 24 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Runtime skipped per user; inventory only |
| components/organisms/AdminPayoutLookup.tsx | 71 / 0,0,0,0 | 1 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Runtime skipped per user; inventory only |
| components/organisms/AppChrome.tsx | 171 / 0,0,2,1 | 1 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/ApplicationsJobList.tsx | 198 / 0,0,0,0 | 0 / 0 | useMemo candidate for invitation summaries/map after dataset fix; no measured render cost; no blanket callback/ref changes. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/ApplicationsPage.tsx | 144 / 0,0,0,0 | 0 / 1 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/ApplicationStatusPage.tsx | 205 / 0,1,2,2 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/ApplicationsWorkspacePage.tsx | 699 / 0,0,0,0 | 0 / 1 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/AuthProgress.tsx | 22 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/BillingPage.tsx | 632 / 0,0,0,0 | 2 / 3 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/BookingsPage.tsx | 721 / 1,0,0,0 | 4 / 3 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/CalendarPage.tsx | 26 / 0,0,0,0 | 0 / 0 | Fix functionality first; 35 cheap cells do not justify memoization. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/ConversationThreadPicker.tsx | 132 / 0,0,4,1 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/DashboardMessages.tsx | 67 / 0,0,0,1 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/dashboards/SchoolDashboard.tsx | 101 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/dashboards/TeacherDashboard.tsx | 3 / 0,0,0,0 | 0 / 0 | Profile aggregate computations after PF-08; clock state is visual and should not become a ref. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/DeleteJobModal.tsx | 26 / 0,0,0,0 | 0 / 1 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/FindJobsPage.tsx | 118 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/FindTeachersPage.tsx | 322 / 0,0,1,1 | 1 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/ForgotPasswordRouteClient.tsx | 445 / 0,0,1,1 | 2 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/FoundingInterestForm.tsx | 323 / 0,0,0,0 | 1 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/FoundingInterestPage.tsx | 365 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/FoundingSchoolSections.tsx | 255 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/FoundingTeacherSections.tsx | 268 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/HomeWaitlistSection.tsx | 307 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/InstitutionDashboard.tsx | 148 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/InstitutionProfilePage.tsx | 132 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/InvitationErrorNotice.tsx | 36 / 0,1,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/InvitationModal.tsx | 206 / 0,0,1,0 | 1 / 1 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/InvoiceDetailsModal.tsx | 82 / 0,0,0,0 | 0 / 1 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/JobDetailPage.tsx | 255 / 0,0,0,0 | 0 / 1 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/JobInvitationsPage.tsx | 219 / 0,0,1,1 | 0 / 1 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/JobManagementList.tsx | 204 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/LandingPage.tsx | 131 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/LoginPage.tsx | 186 / 0,0,0,0 | 1 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/LoginRouteClient.tsx | 450 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/MessageAttachmentPreview.tsx | 199 / 0,0,2,3 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/MessagingPage.tsx | 897 / 4,1,4,4 | 0 / 0 | Profile parent-held drafts and rows; existing list/group useMemo retained. Consider isolated composer/rows; callbacks only with stable memo boundaries. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/MyProfilePage.tsx | 198 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/NotificationBell.tsx | 198 / 0,1,2,1 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/NotificationSettings.tsx | 61 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/onboarding/CountryCityFields.tsx | 59 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/onboarding/DocumentPreviewModal.tsx | 80 / 0,0,0,0 | 0 / 1 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/onboarding/ReviewCard.tsx | 79 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/onboarding/steps/AccountBasicsStep.tsx | 130 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/onboarding/steps/DocumentUploadStep.tsx | 89 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/onboarding/steps/InstitutionComplianceStep.tsx | 97 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/onboarding/steps/InstitutionDetailsStep.tsx | 159 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/onboarding/steps/InstitutionProfileStep.tsx | 70 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/onboarding/steps/InstitutionStaffingStep.tsx | 63 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/onboarding/steps/ReviewStep.tsx | 33 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/onboarding/steps/TeacherDocumentsStep.tsx | 110 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/onboarding/steps/TeacherProfileStep.tsx | 112 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/onboarding/UploadCard.tsx | 140 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/onboarding/useOnboardingForm.tsx | 870 / 4,0,7,6 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/OnboardingPage.tsx | 565 / 0,0,0,0 | 1 / 1 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/OnboardingRouteClient.tsx | 420 / 0,0,0,1 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/PayInvoiceModal.tsx | 204 / 0,0,1,2 | 1 / 1 | Lazy-load secure payment boundary (PF-02); memo hooks do not fix eager vendor scripts. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/PayoutCallbackPage.tsx | 33 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/PayoutSettings.tsx | 143 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/PostAuthRedirectClient.tsx | 63 / 0,0,0,1 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/PostJobPage.tsx | 953 / 0,0,2,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/ProfileReviewsPanel.tsx | 97 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/PublicFooter.tsx | 35 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/PublicHeader.tsx | 115 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/PublicHeaderAccountSlot.tsx | 55 / 0,0,0,1 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/PublicProfileReviews.tsx | 40 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/PublicTeacherProfilePage.tsx | 136 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/RecentNotifications.tsx | 92 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/RegisterInterestForm.tsx | 6 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/RouteShell.tsx | 213 / 1,2,0,1 | 0 / 0 | Split eager feature boundaries (PF-03); stabilize context/props only if profiling supports it; no global memo patch. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/SecurityPage.tsx | 462 / 0,0,0,1 | 3 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/SettingsPage.tsx | 843 / 0,0,0,1 | 1 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/SignatoryApprovalPage.tsx | 214 / 0,0,0,1 | 0 / 1 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/SignupAccessPage.tsx | 318 / 0,0,0,0 | 1 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/SignupRouteClient.tsx | 306 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/SignupVerifyPage.tsx | 241 / 0,0,1,1 | 1 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/StripePayoutComponents.tsx | 122 / 0,0,0,2 | 0 / 0 | Lazy-load secure payment boundary (PF-02); memo hooks do not fix eager vendor scripts. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/TeacherApplicationsPage.tsx | 214 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/TeacherDashboard.tsx | 146 / 0,0,0,0 | 0 / 0 | Profile aggregate computations after PF-08; clock state is visual and should not become a ref. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/TeacherHireActions.tsx | 31 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/TeacherProfilePage.tsx | 35 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/TweaksPanel.tsx | 86 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/TwoFactorChallengePage.tsx | 157 / 0,0,0,1 | 1 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/WaitlistConfirmation.tsx | 257 / 0,0,1,1 | 1 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/WaitlistSchoolIntro.tsx | 30 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/WaitlistTeacherIntro.tsx | 31 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/organisms/WorkspacePanels.tsx | 56 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |
| components/route-shell.tsx | 56 / 0,0,0,0 | 0 / 0 | React.memo/useMemo/useCallback/useRef: no new use justified without profiling; retain existing behavior. | Only named route/interaction evidence above; remaining conditional states NOT TESTED |

## 12. Rendering strategy recommendations (audit only)

| Route family | Current observed build model | Recommendation / reasoning |
| --- | --- | --- |
| /, /terms, /how-it-works | Statically prerendered | Keep server/static marketing content; remove prototype content, split nonessential CSS/client islands. |
| /founding-schools, /founding-teachers | Dynamic server render (query/source parameters) | Consider static main content with a small query-aware client form if campaign attribution can be preserved; no change applied. |
| /login, /signup | Dynamic server render; form initially gated until mount | Keep per-request auth/availability checks; render stable initial shell and reduce hydration/layout shift. |
| /forgot-password | Statically prerendered shell | Keep generic public shell; mutation and challenge state remain request-specific. |
| All authenticated workspace pages | Dynamic, server auth then client-selected content | Do not SSG/ISR private data. Keep authoritative auth dynamic; request-dedupe/hydrate minimal data and split feature modules. |
| /onboarding, /post-auth | Dynamic snapshots / redirects | Preserve live compliance enforcement; reduce repeated I/O and add error boundaries/countdown. |
| /signatory-approval/[token] | Dynamic token-bearing workflow | No public/shared cache; valid and expired token errors need dedicated states. |
| /payouts/return, /payouts/refresh | Force dynamic | Keep private/session-sensitive; refresh can create a Stripe session, so do not prefetch/replay as a harmless read. |
| Loading/error boundaries | Root/group loading/error files; no global-error.tsx | Use stable loading geometry and deliberate root/post-auth recovery. Suspense exists but is not a guarantee of backend waterfall removal. |

Installed configuration does not enable Cache Components or React Compiler. Recommendations use existing Next 16 APIs only after version-specific verification; do not copy caching defaults from Next 13 tutorials. Server fetch caching and downstream browser/CDN response caching are distinct policies.

## 13. Overall readiness and approval boundary

**Hold unrestricted production sign-off** until the two P1 issues are resolved and the highest-impact P2 failures have regression coverage. The UI foundation, initial responsiveness, real login and read flows are viable; passing build/lint and sparse-account browser checks do not establish end-to-end transaction safety.

Admin remains excluded. A fresh setup account, valid approval token, disposable jobs/bookings/invoices, Stripe test configuration and appropriate OTP delivery fixtures are needed to close the documented state gaps. Those gaps are not hidden passes. No further code changes or deployment are authorized by this audit. Review the prioritized findings and choose the implementation scope.

## 14. Evidence, reproduction and references

Audit-only runners: inventory.mjs, cdp.mjs, browser-audit.mjs, login.mjs (credentials via process environment only), interactions.mjs, edge-checks.mjs, performance.mjs, source-regressions.mjs. The complete evidence folder is [audit evidence folder](docs/audit-2026-10-27/); structured inventory is [inventory.json](docs/audit-2026-10-27/inventory.json); compact API inventory is [api-request-inventory.csv](docs/audit-2026-10-27/api-request-inventory.csv); component matrix is [component-inventory.csv](docs/audit-2026-10-27/component-inventory.csv). Runners do not install dependencies or modify application source. Some tests are account-state-dependent and must not be blindly used against production.

Production verification commands were npm.cmd run build and npm.cmd run lint. Next start emitted an output:standalone advisory; the local server still served the newly built routes. This is not a deployment audit. The read-only backend findings refer to sibling ../supplyed-backend, not a changed backend.

Reference checks used installed source/config plus primary documentation: [Next fetch cache options](https://nextjs.org/docs/app/api-reference/functions/fetch), [Next React Compiler option](https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler), [TanStack Query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation), [Stripe Connect pure loader](https://github.com/stripe/connect-js#importing-loadconnect-without-side-effects), [WCAG 2.2](https://www.w3.org/TR/WCAG22/), and [target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum). Current documentation can describe newer minor versions; installed 16.2.9 source was used to establish actual project configuration.

A small-target geometry candidate is not automatically a WCAG failure: inline-link and spacing exceptions require context. Automated best-practice landmark warnings are distinguished from verified contrast/accessibility-name violations. No compliance guarantee, field speedup or exhaustive coverage claim is made.
