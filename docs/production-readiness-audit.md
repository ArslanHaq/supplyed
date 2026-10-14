# SupplyED — Production Readiness Audit

**Audit date:** 14 October 2026 · **Commit:** `f95c80d` · **Branch:** `fix/Ui`

**Score: 50/100 — Not ready for production launch.**

This is a condensed code-inspection report. The application is a Next.js 16.2.9 / React 19 frontend and API proxy for a separate Nest backend, with Auth.js sessions, TanStack Query, Socket.IO, signed storage uploads, and Stripe components. Backend databases, authorization, transactions, webhooks, and infrastructure were outside this audit's scope. Application code was not changed.

**Post-audit update:** Frontend safeguards have since been implemented. See
[the fix and verification summary](production-safety-fixes.md). The score,
probabilities, line references and verification results below describe the original
pre-fix snapshot, not the updated working tree.

## Verification

- **Tests:** 72 passed, 0 failed.
- **Lint:** passed without cache.
- **Type check:** standard check failed on malformed generated `.next/dev/types/routes.d.ts:124`; an in-memory source-only check passed. This does not establish a successful clean production build.
- **Targeted in-memory probes:** reproduced duplicate refresh requests, session expiration on backend 503, production mock login, partial job creation, malformed-entity exceptions, and inline HTML preview responses.
- **Not completed:** production/Docker builds, browser/load tests, live backend verification, and full dependency audit. Network approval review blocked the latter because it would disclose dependency metadata to npm; transmission approval remains pending.

## Principal findings

Percentages are **heuristic estimates of at least one occurrence within 30 production days**, not measured probabilities. They assume daily use, an internet-facing launch, and the supplied deployment configuration. Confidence reflects evidence and applicability. Conditional vulnerabilities are not confirmed exploits.

| ID | Severity | 30-day likelihood / confidence | Evidence and impact | Recommended fix |
|---|---|---|---|---|
| F1 | High | 60% / Med — token expiry and parallel requests are routine | `lib/server/token-refresh.ts:38,142,186`: refresh persistence errors are swallowed; concurrent requests refresh independently; even a 503 expires the session. Rotation policy affects the resulting logout risk. | Refresh in a cookie-writable boundary, coordinate per session across replicas, and preserve credentials on transient errors. |
| F2 | High | 35% / High — upstream stalls are plausible | `lib/server/token-refresh.ts:132`; `features/settings/actions.ts:278`; `features/onboarding/documents.ts:380`: refresh/storage fetches lack application deadlines, retaining resources during stalls. | Apply total deadlines and propagate cancellation; retry only operations with established idempotency. |
| F3 | High | 20% / Med — depends on external ingress limits | `app/api/conversations/[id]/attachments/route.ts:17`: multipart bodies are buffered before size validation and authentication, exposing memory/CPU exhaustion. | Authenticate first; enforce byte/part limits while reading or use signed direct uploads. |
| F4 | High | 10% / High — requires missing/empty backend configuration | `features/auth/backend.ts:116,383`: absent `API_BASE_URL` accepts arbitrary credentials as a verified mock user, including in production. Real backend access was not demonstrated. | Reject invalid production configuration; prohibit production mock mode. |
| F5 | High | 5% / Med — requires unsafe content to pass backend/storage validation | `app/api/onboarding/documents/[documentId]/preview/route.ts:46`: forwards arbitrary content types inline without sandbox or nosniff. Active content could execute on the app origin. | Restrict preview MIME types, sandbox content, add nosniff, and isolate unsupported downloads. |
| F6 | High | 3% / Low exploitation confidence — attack path unproven | `package-lock.json:5308`: Next.js 16.2.9 falls within an AVIF image-optimization RCE advisory range. The visible image component is unoptimized; exploitable AVIF input was not established. | Upgrade to a supported patched release and complete dependency/reachability checks. |
| F7 | Medium | 100% / High — when using messaging in the supplied Docker deployment | `Dockerfile:8`; `features/conversations/socket.ts:23`: the build omits `NEXT_PUBLIC_API_URL`, disabling live messaging. Runtime env cannot repair the browser bundle. | Supply the public socket origin at build time or implement runtime browser configuration. |
| F8 | Medium | 75% / High — common images exceed 1 MB | `features/settings/actions.ts:198`; `features/settings/use-settings.ts:82`: the UI permits 5 MB images but the Server Action transport defaults to 1 MB. Uploads fail before action validation. | Use a bounded upload route/direct storage, or deliberately align all transport and file limits. |
| F9 | Medium | 60% / High — unexpected failures are plausible | `lib/server/route-error.ts:11`; `deploy/docker-compose.main.yml:23`: generic errors lack local logging/correlation; health only checks the manifest. | Add redacted structured logs, request IDs, latency/error metrics, and separate readiness checks. |
| F10 | Medium | 50% / Med — depends on release frequency and external gates | `.github/workflows/dev-cicd.yml:3,34,99`: tests are omitted, automatic checks target only dev, and deployment has no health wait or rollback. | Gate launch branches with tests; deploy immutable releases with readiness, smoke tests, and rollback. |
| F11 | Medium | 35% / High — once a socket URL is configured | `features/conversations/use-conversations.ts:45,95`: polling stops based on configuration rather than actual connection health, leaving threads stale during disconnects. | Poll while disconnected and invalidate on successful connection/reconnection. |
| F12 | Medium | 30% / Med — depends on job count and backend latency | `features/applications/queries.ts:71`; `features/onboarding/actions.ts:503`: application counts make one request per job, and navigation reloads detailed onboarding state. | Add aggregate count/lightweight status endpoints and bound total request work. |
| F13 | Medium | 20% / High — later write fails after earlier commit | `features/jobs/actions.ts:16`; `features/settings/actions.ts:330`: multi-step writes report failure after partial success, encouraging duplicate drafts or inconsistent state. | Use transactional commands or explicit partial-success results with resumable, idempotent retries. |
| F14 | Medium | 10% / High — malformed proposal input | `features/applications/rich-text.ts:25`: `String.fromCodePoint` throws for `&#x110000;`, breaking validation/rendering. | Validate Unicode range and handle malformed action inputs inside error boundaries. |

Dependency reference: [Next.js maintainer advisory GHSA-2xp9-vwfh-vxw4](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4). Version match is confirmed; application exploitability is not.

## Scorecard and incident estimates

| Category | Readiness /10 |
|---|---:|
| Stability | 6 |
| Performance | 5 |
| Logic correctness | 6 |
| Resilience | 4 |
| Security | 5 |
| Scalability | 5 |
| Observability | 3 |
| Maintainability | 6 |
| Deployment/configuration | 5 |

| Event within 30 days | Estimate | Confidence / main reason |
|---|---:|---|
| Unhandled route/render failure | 25% | Med — malformed input; does not necessarily mean process termination |
| Major delay/timeout | 70% | Med — missing deadlines and backend request amplification |
| Data loss/inconsistency | 20% | Low — partial writes and misleading save results; physical database corruption not demonstrated |
| Security incident | 10% | Low — conditional upload, preview, configuration, and dependency exposure |
| Outage under load | 30% | Low — buffering, fanout, and single-container deployment; no load measurements |

These events overlap; do not add their probabilities.

## Fix roadmap

**Fix now:** Correct session refresh (F1), add deadlines (F2), bound uploads (F3), disable production mock behavior (F4), isolate previews (F5), and resolve dependency security exposure (F6).

**Before launch:** Repair public socket configuration and image uploads (F7–F8), add diagnostics and release gates (F9–F10), handle disconnected sockets (F11), bound backend work (F12), and fix partial writes and entity decoding (F13–F14).

**Later:** Expand browser coverage, measure capacity, simplify large modules, and pin reproducible base images. Review database migrations, backups, backend ownership checks, and webhook idempotency separately.

**Quick wins, usually under one engineer-hour each:** reject missing production config; add fetch deadlines; preserve sessions on transient refresh failures; restrict preview content; pass the socket build variable; add tests/main checks to CI; guard Unicode code points. Deployment and regression validation are additional work.

**Larger changes:** coordinated refresh and session persistence; bounded/direct uploads; transactional or resumable business operations; aggregate backend endpoints; telemetry and rollback-capable deployment.

## Tests to write first

1. Real Next session-cookie refresh: Server Component rendering, concurrent requests/tabs, token rotation, 401 versus 429/503, timeouts.
2. Anonymous/oversized/chunked multipart uploads, aggregate part limits, cancellation, and concurrent memory use.
3. Production startup with missing configuration and Docker browser socket configuration.
4. HTML/SVG preview rejection, sandbox headers, unauthorized documents, and storage stalls.
5. Image uploads across the 1 MB and 5 MB boundaries through the actual transport.
6. Second-step write failures and retries without duplicate jobs or misleading save state.
7. Socket disconnection/reconnection, malformed entities/action inputs, and large-job request budgets.
8. Production container readiness, authenticated smoke checks, and rollback after failed startup.
