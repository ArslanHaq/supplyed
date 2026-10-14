# SupplyED frontend safety fixes

Date: 14 October 2026. Changes are local and have not been deployed.

The existing page layout, four-step job form, navigation, and backend request
contracts are preserved. No backend changes or new dependencies are required.

## Implemented

- Uploads: authenticate before reading conversation files; enforce multipart byte
  limits while reading; reject cross-origin uploads; bound storage requests.
  Onboarding continues to honor the backend's document limits and replacement flow.
- Previews: preserve PDF/image previews and file bytes; sandbox responses and force
  active or unsupported content to download instead of running on the app origin.
- Profile photos: align the Server Action transport limit with the advertised 5 MiB.
- Jobs: reject duplicate clicks; retain the created job ID when activation fails so
  retry updates the same job; return validation errors through the existing UI.
- Sessions: share concurrent refreshes within one process, persist rotated cookies
  per caller, and preserve sessions on temporary authentication-service failures.
- Settings: validate both payloads and profile presence before saving; explicitly
  report partial saves when the second backend request fails.
- Messaging: restore polling when the socket is unavailable and refetch on reconnect.
- Other safeguards: reject production mock-backend mode, handle invalid Unicode,
  bound count pagination, add request deadlines and redacted error references,
  disable the unused image optimizer, and add configuration health checks.
- Deployment: pass the optional public socket URL into Docker builds, run tests on
  dev/main, gate deployment on production HTTP checks, and wait for container health.

## Verification

| Check | Result |
|---|---|
| Regression suite | 92 passed, 0 failed; includes 20 new safety tests |
| ESLint | Passed |
| Production build and TypeScript | Passed |
| Production HTTP smoke suite | 7 passed, 0 failed |
| Diff whitespace check | Passed |

The HTTP suite starts the real built Next server with an isolated in-memory
backend/storage fixture. It verifies authenticated pages and redirects, document
upload/replacement/preview, conversation upload/preview, a 5 MiB profile photo,
draft creation, publication, activation retry without duplicate creation, session
cookie refresh, and upload/preview rejection cases. Component-level tests exercise
the four job-form steps, double submission, retry, and final navigation.

Run: `npm test`, `npm run lint`, `npm run build`, `npm run test:smoke`.
The malformed local generated Next type cache found during the audit was regenerated.

## Remaining limits

- These are automated local checks, not a live-backend, browser-interaction, Docker,
  or load test. Real storage, OAuth, Stripe and production proxy behavior are unverified.
- Refresh coordination is process-local with a 30-second grace window. Full
  multi-replica rotation safety needs backend/session architecture work.
- Atomic profile/job writes and idempotent recovery after a lost creation response
  require backend support. The frontend retry safeguard covers a returned saved ID
  while the job form remains mounted.
- Application counts still need an aggregate backend endpoint for efficient scale.
- The health endpoint checks configuration and server responsiveness, not upstream
  availability. Automatic rollback, metrics and distributed tracing remain open.
- Dependencies were not upgraded or fully audited. The unused image optimizer is
  disabled as a mitigation; this does not establish that all advisories are resolved.
  Automatic approval review previously rejected the npm audit network request
  because it would transmit dependency metadata. That audit remains incomplete.

The original audit score and probabilities describe the pre-fix snapshot; a new
production-readiness score is not asserted from these local checks.
