const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const roots = {web: root, backend: path.resolve(root, '../supplyed-backend'), admin: path.resolve(root, '../supplyed-admin')};
const refs = (repo, file, needle) => {
  const lines = fs.readFileSync(path.join(roots[repo], file), 'utf8').split('\n');
  const index = lines.findIndex(line => line.includes(needle));
  if(index < 0) throw new Error(`Missing reference ${repo}/${file}: ${needle}`);
  return `${repo}/${file}:${index + 1}`;
};
const w = (file, needle) => refs('web', file, needle);
const b = (file, needle) => refs('backend', file, needle);
const a = (file, needle) => refs('admin', file, needle);
const findings = [];
function f(id, severity, status, title, category, locations, explanation, impact, evidence, fix, difficulty, journey) {
  findings.push({id, severity, status, title, category, locations, explanation, impact, evidence, fix, difficulty, journey});
}
f('A01','P1','Code-inspection','Both Next.js applications use a version affected by a published Server Actions denial of service','Dependency security',[
  w('package.json','"next"'), a('package.json','"next"'), w('features/auth/actions.ts','use server'), a('app/actions/auth.ts','use server'), w('next.config.mjs','const nextConfig')],
  'Installed Next.js is 16.2.9 in both applications. The web uses App Router and Server Actions; admin also has server action code. This meets the documented conditions for GHSA-p3m5-59mp-jv5r. The finding is version/configuration matching, not an exploit test.',
  'An unauthenticated crafted action request can consume CPU and block request processing according to the upstream advisory. Separately, the same version is within the range for a Windows-filesystem RCE advisory; this local workspace is Windows, but public runtime applicability is UNVERIFIED and infrastructure is outside scope.',
  'Compare audit-evidence/installed-versions.json with the [official Server Actions advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r), published 2026-10-14: affected 16.0.0–16.4.0, fixed 16.4.1. The [Windows RCE advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) affects 16.x before 16.3.3 when using Windows filesystem hosting without Cache Components. No attack payload was sent.',
  'Upgrade both applications to a supported patched Next.js release, at least 16.4.1 for the cited Server Actions issue; check the compatible React/RSC packages and regenerate lockfiles in the implementation phase. Repeat advisory scanning and auth/action regression tests. Treat any externally reachable affected Windows instance as urgent without waiting for an exploit demonstration.',
  'Medium','All public pages, authentication and server actions');
f('A02','P1','Verified','Password reset does not revoke refresh sessions, and refresh tokens are reusable','Authentication/session management',[
  b('src/modules/auth/auth.service.ts','async refresh('),b('src/modules/auth/auth.service.ts','async resetPassword('),b('src/modules/auth/auth.service.ts','private async signTokens('),b('prisma/schema.prisma','model RefreshToken')],
  'Refresh verifies the JWT, current user and 2FA flag, then issues another token pair without checking a persisted session or invalidating the presented token. Reset changes the password and consumes OTPs but never invalidates existing sessions. The RefreshToken schema is not used by this auth path.',
  'A stolen refresh token remains useful after account recovery. An attacker can repeatedly renew the session; clearing the legitimate browser cookie does not revoke the stolen backend credential.',
  'Run node audit-evidence/verify-findings.cjs; AUTH-REVOCATION logs in a synthetic fixture, resets its password using real bcrypt, then successfully refreshes the same old token twice. Persistence is mocked; no real account was accessed. JWTStrategy also has no password-change epoch/session check.',
  'Persist hashed refresh tokens with session/family identifiers, rotate atomically and detect reuse. Revoke sessions on reset, sensitive credential changes and explicit logout. Define whether access tokens expire naturally or are invalidated through a user/session epoch.',
  'Hard','Login → refresh → logout/password recovery');
f('A03','P1','Verified','BFF requests share a very small backend IP rate-limit budget','Authentication availability',[
  b('src/common/guards/rate-limit.guard.ts','const ip ='),b('src/common/guards/rate-limit.guard.ts','const limit ='),w('lib/server/api-client.ts','Accept:'),a('lib/auth/authenticate.ts','response = await fetch')],
  'The backend permits five email-send operations and ten other POST operations per IP per fifteen minutes. Browser operations are forwarded by the Next server without a trusted per-client identity for this limiter. In the normal server-to-server path users therefore share the BFF source-IP bucket. Additional email/token buckets do not prevent the earlier shared-IP rejection.',
  'A handful of legitimate registrations/resets can deny service to unrelated users behind the same BFF. The same mismatch affects login and refresh under modest concurrent usage.',
  'BFF-RATE-BUDGET invokes the actual guard with six different emails and one source IP: five allowed, sixth 429 with Retry-After 900. SQL counter is mocked. Runtime proxy topology was not inspected; the shared-IP consequence is conditional on the ordinary BFF source-IP path evidenced in the clients.',
  'Design distinct end-user, account, and service budgets. Establish a trusted authenticated BFF-to-API client identity/forwarding contract and enforce per-client limits at the appropriate layer. Never trust arbitrary public X-Forwarded-For values. Test multiple users through one BFF and direct API abuse.',
  'Medium','Registration, OTP resend, password recovery, login and refresh');
f('A04','P1','Verified','An administrator with 2FA enabled cannot complete admin login','Authentication/frontend contract',[
  a('lib/auth/authenticate.ts','two_factor_required'),a('auth.ts','Credentials'),b('src/modules/auth/auth.service.ts','twoFactorRequired: true')],
  'The backend correctly returns a two-factor challenge, but authenticateAdmin treats it as a terminal failure. The admin credentials provider has no challenge/code exchange path.',
  'Enabling a desirable security control can lock an administrator out of the administration application until another recovery path is used.',
  'ADMIN-2FA substitutes a valid-shaped backend challenge and executes authenticateAdmin: result is {ok:false, code:two_factor_required}. Source inspection confirms no matching admin challenge-completion flow. Browser login was not executed.',
  'Add an admin 2FA challenge screen and server-side verification exchange before issuing the admin session. Keep challenge tokens off general browser session objects and cover invalid/replayed codes and recovery codes.',
  'Medium','Admin login with TOTP or recovery code');
f('A05','P1','Verified','Admin user creation always omits a mandatory backend role','Frontend/backend validation contract',[
  a('app/api/users/route.ts','const inputSchema'),a('app/api/users/route.ts','body: parsed.data'),b('src/modules/users/dto/admin-create-user.dto.ts','extends RegisterDto'),b('src/modules/auth/dto/register.dto.ts','role!:')],
  'The admin request schema contains no role and Zod strips unknown role fields. AdminCreateUserDto inherits RegisterDto, which requires a signup role. The UI intent of creating a generic USER and the backend registration contract disagree.',
  'Administrators cannot create users through this form; retries cannot resolve the validation failure.',
  'ADMIN-USER-ROLE-CONTRACT executes the real BFF input parsing, captures the forwarded body, and runs actual class-validator validation against AdminCreateUserDto. Even a supplied INSTRUCTOR role is removed; the backend DTO rejects the missing role. The HTTP backend response is mocked as 400; no account was created.',
  'Define a dedicated admin-create contract: either create USER explicitly on the backend or expose a permitted role selector and retain its validated value. Share/generate contract types and test BFF → DTO validation together.',
  'Easy','Admin → Users → Create user');
f('A06','P1','Code-inspection','Required-document workspace gating is not rechecked by hiring mutations','Authorization/business rules',[
  w('features/onboarding/profile-progress.ts','missingRequiredDocuments(snapshot'),w('components/route-shell.tsx','hasSubmittedApplicationStatus(applicationStatus)'),b('src/modules/applications/applications.repository.ts',"teacher?.status !== 'ACTIVE'"),b('src/modules/jobs/job-policy.ts','school.status !== ProfileStatus.ACTIVE'),b('src/modules/documents/documents.repository.ts','softDelete(id: string)')],
  'The web treats missing required documents as no completed profile and redirects to onboarding. Deleting a document only soft-deletes the document; it does not change the ACTIVE profile status. Application creation and school eligibility check ACTIVE status without the current document requirements. Thus an already-approved user can remove a required document and use the backend mutation directly despite the web gate.',
  'Previously approved participants can continue marketplace actions with required evidence missing. This is a concrete frontend/backend policy mismatch; the intended legal/compliance consequences and whether every document review must gate hiring are not assumed.',
  'Trace ACTIVE profile → DocumentsRepository.softDelete → profileEntryStatus returns none → direct application create checks only teacher ACTIVE and lockEligibleSchool ACTIVE. Global JWT validation returns current user role, not current document eligibility. This sequence was inspected, not executed against a database.',
  'Define one backend eligibility policy and enforce it inside relevant hiring transactions, including document removal/replacement and required trust approvals. Make the frontend consume that policy result. Specify expiry/review rules explicitly; stored documentExpiryDate currently does not supply a hiring gate.',
  'Hard','Approved teacher/school changes evidence → apply/post/hire');
f('A07','P2','Verified','A password-reset OTP can be consumed twice under concurrency','Recovery/data integrity',[
  b('src/modules/auth/auth.service.ts','async resetPassword('),b('src/modules/auth/auth.service.ts','await this.usersService.updatePassword(user.id, hashedPassword)'),b('src/modules/auth/password-reset-otp.repository.ts','consumeAllForUser')],
  'Reading an active OTP, comparing it, changing the password and consuming the OTP are separate operations. Two requests can both read the unused OTP before either consumes it.',
  'Two password writes can succeed for one supposedly single-use code, leaving the final password dependent on request order. This requires knowledge of a valid OTP; it is not an OTP-guessing or unauthenticated account-takeover demonstration.',
  'OTP-CONCURRENCY sends two concurrent resetPassword calls with the same synthetic valid OTP and different passwords; both fulfill and two password writes occur. Uses actual service/bcrypt with mocked persistence, so real database scheduling remains untested.',
  'Atomically claim/consume the unexpired OTP with a conditional update and update the password in the same transaction. Require exactly one successful claim; invalidate sessions in that transaction as part of A02. Review email verification consumption for the same pattern.',
  'Medium','Password recovery, duplicate submissions');
f('A08','P2','Verified','Forgot-password decoy JWTs disclose account existence and role','Information disclosure',[
  b('src/modules/auth/auth.service.ts','async forgotPassword('),b('src/modules/auth/auth.service.ts','id: user?.id ?? randomUUID()'),b('src/modules/auth/auth.service.ts','role: user?.role ?? Role.INSTRUCTOR')],
  'The public response uses a signed, readable JWT containing the actual user ID and role for existing users. Unknown emails get a fresh random ID and INSTRUCTOR role. Signing does not hide the payload.',
  'A caller can identify administrator/institution accounts from one response and distinguish instructor existence by comparing stable versus changing subjects across two requests. The OTP is still required to reset a password.',
  'RESET-ENUMERATION uses existing ADMIN and absent fixture emails: decoded roles differ. Source confirms existing subjects remain stable and absent subjects are freshly randomized. No production emails or tokens were used.',
  'Return an opaque, uniformly shaped recovery transaction identifier with the user mapping kept server-side; make existing and absent requests indistinguishable in payload and handling. Avoid exposing role and stable account identifiers in public recovery challenges.',
  'Medium','Public forgot-password form');
f('A09','P2','Verified','Accepted long passwords collide after bcrypt’s first 72 bytes','Password validation',[
  w('features/auth/schemas.ts','128'),b('src/modules/auth/auth.service.ts','bcrypt.hash(registerDto.password'),b('src/modules/auth/dto/register.dto.ts','password!:')],
  'The web accepts passwords up to 128 characters, while bcrypt uses only the first 72 bytes. Backend registration does not impose a compatible byte-length maximum. Multibyte characters can hit the limit earlier than a character count suggests.',
  'Users can believe distinct long passwords differ when authentication treats them as identical. This reduces the effective password and can make a suffix-only password change ineffective.',
  'PASSWORD-72-BYTES hashes a valid 72-byte prefix plus one suffix; bcrypt.compare accepts the same prefix with a different suffix. The first password also passes the actual frontend validator. No real password is printed.',
  'Choose an explicit hashing/length strategy. Prefer a modern password hash with a deliberate migration plan, or reject inputs exceeding bcrypt’s byte limit consistently before hashing. Do not silently truncate or introduce ad hoc prehashing.',
  'Medium','Signup, password reset/change, login');
f('A10','P2','Verified','Distinct instant withdrawals can reuse the same Stripe idempotency key','Payments/idempotency',[
  b('src/modules/payments/instant-payouts.service.ts','async withdraw('),b('src/modules/payments/instant-payouts.service.ts','idempotencyKey:')],
  'The key is constructed from account, currently available balance and withdrawal amount. Those values can recur after new earnings, and the destination is not part of the identity. Balance is not a unique business-operation ID.',
  'A later legitimate withdrawal may receive the old success response without a new payout, or a parameter mismatch if the destination changed. This is not evidence of a duplicate debit or stolen funds.',
  'PAYOUT-KEY-COLLISION executes two distinct service calls with a recurring mocked balance and observes identical provider keys. Stripe was not called. [Stripe’s idempotency documentation](https://docs.stripe.com/api/idempotent_requests) describes replay of the first result and retention for at least 24 hours.',
  'Persist a withdrawal intent with a unique ID and immutable amount/destination. Reuse its key only for retries of that intent; create a new key for new business requests. Reconcile returned provider IDs to intent state.',
  'Medium','Teacher → payouts → cash out, retry and later withdrawal');
f('A11','P2','Verified','Instant-payout BFF lacks the origin/content-type guard used on other mutations','CSRF defense',[
  w('app/api/payments/payout-account/instant-payout/route.ts','export async function POST'),w('app/api/payments/payout-account/instant-payout/route.ts','request.json()')],
  'The cookie-authenticated route accepts JSON parsed from text/plain and does not check Origin or Fetch Metadata. Unlike a Next Server Action, this ordinary POST handler does not receive Server Action origin protection.',
  'A hostile same-site sibling origin could submit a payout request when the browser sends the session cookie. SameSite=Lax normally blocks cookies on ordinary cross-site POSTs, so this is not a demonstrated arbitrary cross-site exploit. Real cookie delivery and host relationships were not tested.',
  'PAYOUT-ORIGIN invokes the real handler with a sibling Origin and text/plain JSON body, forwarding to a mocked API and returning 201. The mock bypasses session acquisition, so the verified fact is acceptance at the route boundary, not a completed browser CSRF attack.',
  'Apply the shared same-origin mutation guard, validate application/json and/or a CSRF token, and enforce appropriate Fetch Metadata policy. Cover sibling-origin, missing-origin and valid same-origin cases while preserving intentional non-browser API clients at the bearer-authenticated backend.',
  'Easy','Teacher instant payout');
f('A12','P2','Verified','Socket per-conversation throttles have unbounded keys and no aggregate event cap','Messaging/resource exhaustion',[
  b('src/modules/conversations/conversations.gateway.ts','typing: Map'),b('src/modules/conversations/conversations.gateway.ts','async onRead('),b('src/modules/conversations/conversations.gateway.ts','data.readAt.set'),b('src/modules/conversations/conversations.gateway.ts','data.typing.set')],
  'A connected authenticated user can vary UUID-shaped conversation IDs. IDs enter readAt/typing maps before service ownership verification; entries are retained for the socket lifetime. Per-ID throttles do not bound aggregate events.',
  'A long-lived client can grow server memory and cause repeated database lookups using IDs it does not own. Service ownership checks still protect conversation data.',
  'SOCKET-UNBOUNDED-MAPS makes only 50 local method calls with random UUIDs: 50 retained entries and 50 service lookups. Service/persistence is mocked, no network sockets or load test used.',
  'Add per-socket/user aggregate event limits, bounded TTL/LRU state, and validated conversation membership before retaining ID-specific state. Include disconnect cleanup and tests with varied invalid IDs.',
  'Medium','Messaging read receipts and typing indicators');
f('A13','P2','Code-inspection','Socket session recheck timer drops rejected promises','Async error handling',[
  b('src/modules/conversations/conversations.gateway.ts','setInterval(() => void this.recheckSessions()'),b('src/modules/conversations/conversations.gateway.ts','private async recheckSessions()'),b('src/modules/conversations/conversations.gateway.ts','await this.usersService.findManyByIds')],
  'The interval discards the recheckSessions promise. fetchSockets or the user lookup can reject outside the per-event run() catch handler.',
  'A transient adapter/database failure can become an unhandled rejection. Depending on runtime rejection policy it can terminate the process; at minimum the security recheck fails without a controlled recovery path. Process termination was not induced.',
  'Inspect the timer callback and the entire async method: neither awaits/catches the rejection nor guards overlapping ticks. The event-handler wrapper is not used by the timer.',
  'Catch and log timer failures with redacted context, prevent overlapping runs, and define retry/disconnect behavior during authorization-store outages. Add a controlled rejected-lookup unit test.',
  'Easy','Live chat during database/adapter interruption');
f('A14','P2','Code-inspection','A crash after claiming job alerts can permanently skip delivery','Notification durability',[
  b('src/modules/matching/matching.repository.ts','UPDATE "Job" SET "matchAlertsSentAt" = NOW()'),b('src/modules/matching/job-match-alerts.worker.ts','claimJobsForMatchAlerts'),b('src/modules/matching/job-match-alerts.worker.ts','releaseJobForMatchAlerts(jobId).catch')],
  'Claiming sets the final sent timestamp before delivery. Catch handlers can release a failed job, but process interruption after claiming cannot run that cleanup. Later claims select only null timestamps and there is no expiring claim lease.',
  'Some published jobs silently miss matching notifications after a crash. Catch-and-release retries do not cover interruption, and the in-memory retry counter is not a durable work record.',
  'Trace claim SQL → alert loop → notification creation → release on caught error. Unlike the separate email-delivery worker’s stale-lease recovery, this claim has no reclaim path. No process crash or database mutation was performed.',
  'Separate claimedAt/leaseExpiresAt from sentAt, reclaim stale claims, and mark sent only after durable notification creation. Prefer an outbox/work table with idempotent recipient records and a visible dead-letter state.',
  'Medium','Publish job → notify matching teachers');
f('A15','P2','Code-inspection','Some admin BFF routes bypass the refresh proxy and fail after token expiry','Session reliability',[
  a('proxy.ts','matcher:'),a('lib/auth/session.ts','Date.now() >= token.accessTokenExpiresAt'),a('app/api/users/route.ts','adminApiRequest')],
  'The proxy performs session refresh but its matcher omits /api/users, /api/dropdowns, /api/conversations and /api/recruiters. getAdminAccessToken only decodes the cookie and rejects expired access tokens; it does not refresh them.',
  'An administrator who leaves a page open past access-token expiry can receive a 401 on the next affected mutation/read despite having a valid refresh token. A full matched page navigation may conceal the issue by refreshing first.',
  'Compare all admin BFF paths in route-inventory.json with proxy.ts. Follow an omitted route into adminApiRequest → getAdminAccessToken → expired. Real timed browser session behavior was not exercised.',
  'Ensure every authenticated BFF path gets a refresh-capable cookie-writing context, or centralize this in a wrapper. Preserve public/auth exemptions explicitly and test expiry without page navigation.',
  'Easy','Long-lived admin sessions and user/dropdown/conversation actions');
f('A16','P2','Code-inspection','Google-only users with 2FA are sent to a password login they cannot use','Social-auth contract',[
  w('features/auth/backend.ts','export async function exchangeOAuthAccount'),w('features/auth/backend.ts','This account has two-factor authentication enabled.'),b('src/modules/google-oauth/google-oauth.repository.ts','password: null')],
  'The backend supports returning a 2FA challenge after Google authentication. The web OAuth exchange throws an instruction to use email/password instead. Newly created Google users have no password.',
  'A Google-only user who enables 2FA cannot complete the normal Google sign-in flow. Password recovery may provide an alternative, but the primary login is broken and the instruction is misleading.',
  'Trace Google user creation with password null → AuthService.createAuthenticatedResponse challenge → exchangeOAuthAccount terminal throw. OAuth provider interaction was not run.',
  'Carry the short-lived backend challenge through a secure server-side continuation and present the existing code/recovery-code screen. Test both password and Google accounts with 2FA enabled.',
  'Medium','Google login after enabling 2FA');
f('A17','P2','Code-inspection','The availability calendar is a static mock with nonfunctional controls','Frontend functionality',[
  w('components/organisms/CalendarPage.tsx','const days ='),w('components/organisms/CalendarPage.tsx','Save changes'),w('components/organisms/CalendarPage.tsx','March 2026'),w('components/organisms/RouteShell.tsx','activePage === "calendar"')],
  'The routed page hardcodes March 2026 and fixed booked/available states. Prev, Next and Save have no handlers, and preference toggles use no-op callbacks. The day generator also produces days beyond March 31.',
  'Teachers cannot manage availability through a screen that promises to control matching. Displayed booked days are invented UI data rather than the user’s bookings.',
  'Read CalendarPage and its live RouteShell branch. There is no state, query or mutation wiring. This is source verification, not a browser interaction test.',
  'Connect a real month model and backend availability/booking data, validate date ranges, persist edits and show save/error state. Until implemented, clearly label or remove the unavailable workflow instead of displaying fictional bookings.',
  'Medium','Teacher availability calendar');
f('A18','P2','Code-inspection','Direct upload tickets do not enforce byte limits before storage or track abandoned uploads','Upload resource controls',[
  b('src/modules/s3/s3.service.ts','async createUploadUrl('),b('src/modules/s3/s3.service.ts','new PutObjectCommand('),b('src/modules/documents/documents.service.ts','Nothing is persisted until upload-complete'),b('src/modules/documents/documents.service.ts','this.assertFileAllowed(requirement.documentType, contentType, sizeBytes)')],
  'Upload authorization validates the declared size, but the signed PUT binds MIME and immutability rather than a byte range. Actual size is checked at upload-complete, which the caller can skip. Document upload tickets are not persisted for application-level expiry cleanup. The bounded web multipart handler does not prevent a bearer-authenticated direct API caller from using the ticket endpoint.',
  'Authenticated users can leave oversized or abandoned objects outside the normal document lifecycle. Approved document replacement is still protected by ownership/CAS, so this is storage/resource abuse rather than arbitrary overwrite.',
  'Trace issue ticket → S3Service signed PUT → optional complete → HEAD size check. No file upload or external storage call was made. Storage-side policies are out of scope and could mitigate the application gap; none are assumed.',
  'Bind upload size through a suitable provider policy or controlled bounded upload path. Persist pending upload intents, enforce per-user quotas and reclaim expired intents/objects. Continue verifying actual bytes and allowed content at completion.',
  'Medium','Document/profile upload, interrupted or malicious upload');
f('A19','P2','Verified','Application HTML responses lack baseline framing and content security headers','Browser security hardening',[
  w('next.config.mjs','async headers()'),a('next.config.ts','const nextConfig')],
  'All tested web HTML responses lacked Content-Security-Policy, X-Frame-Options, X-Content-Type-Options and Referrer-Policy. The web config sets API cache headers only; admin config also defines no general policy. The separate document-preview CSP is a positive exception.',
  'The application supplies no general frame-ancestor protection and has less defense in depth against content injection or referrer leakage. This is not evidence that XSS was found. Upstream-added headers were not audited.',
  'audit-evidence/http-smoke.json records headers for all 30 local page routes from the isolated production build. Admin header absence is code-inspection only because its production build was blocked by font fetching.',
  'Add application-level frame-ancestors (and compatible framing fallback where needed), nosniff, a deliberate referrer policy, and a nonce/hash-based CSP compatible with Next, Stripe, OAuth and required assets. Stage/report CSP violations before enforcement; avoid simply breaking integrations.',
  'Medium','Public and authenticated pages');
f('A20','P2','Verified','Concurrent founding-interest submissions can create duplicates','Database integrity',[
  b('src/modules/contact/contact.service.ts','private async saveFoundingInterestOnce'),b('prisma/schema.prisma','model FoundingInterestSubmission'),b('prisma/schema.prisma','@@index([email])')],
  'The service implements deduplication with find-then-create but the schema has no unique key for normalized email plus interest type. An index improves lookup but does not enforce uniqueness.',
  'Duplicate clicks or concurrent retries can create duplicate waitlist records and duplicate downstream email/admin work.',
  'WAITLIST-DUPLICATE runs two concurrent calls through the actual service with a mocked repository, obtaining two creates. Schema inspection confirms there is no uniqueness backstop. A real PostgreSQL race was not executed.',
  'After reviewing existing duplicates, add the intended unique business key and use upsert or handle unique-conflict responses idempotently. Decide whether historical multiple submissions are intended before choosing the key.',
  'Medium','Founding teacher/school signup');
f('A21','P2','Code-inspection','Applicant ranking materializes and sorts all applicants before pagination','Query/memory scalability',[
  b('src/modules/matching/matching.repository.ts','findApplicationsWithInstructors(jobId'),b('src/modules/matching/matching.service.ts','async rankApplicants('),b('src/modules/matching/matching.service.ts','return paginate(ranked, query)')],
  'The applicant query has no take limit and includes full instructor records. Each page request scores every applicant and sorts the complete list before slicing. The separate recommendation candidate pool has a 2,000-row cap; that cap does not apply here.',
  'Popular jobs increase response memory, CPU and related availability query work even when the UI requests a small page. Repeated pagination repeats that cost.',
  'Trace findApplicationsWithInstructors → loadJobContext → map(scoreMatch) → sort → paginate. Complexity is at least O(n) materialization/scoring and O(n log n) sorting. No large dataset was loaded, so latency thresholds are unmeasured.',
  'Define a bounded ranking strategy: persisted/versioned scores, cached snapshots keyed by relevant inputs, or an asynchronous ranked result with database pagination. Retain fairness and expose stale-score behavior explicitly.',
  'Hard','School applicant ranking and pagination');
f('A22','P2','Code-inspection','Closing a popular job performs two sequential writes per application inside one transaction','Database/transaction scalability',[
  b('src/modules/jobs/jobs.repository.ts','for (const application of applications)'),b('src/modules/jobs/jobs.repository.ts','await tx.applicationStatusHistory.create')],
  'Closing/suspending a job loads all open applications, then individually updates each application and inserts its history in a serial loop within the job transaction.',
  'As applicants grow, transaction duration and lock holding grow linearly with database round trips. The operation can time out and roll back, preventing a popular listing from being closed promptly. No data corruption is claimed because the writes are transactional.',
  'Inspect the CLOSED/SUSPENDED branch of JobsRepository.update. It uses two awaited statements per application before invitation updates. Database timeout behavior under load was not executed.',
  'Use set-based updates and batched history insertion while preserving exact prior statuses and locking invariants. Consider bounded asynchronous closure with an explicit closing state if the product permits it; do not merely increase timeouts.',
  'Medium','School/admin closes or suspends a job');
f('A23','P2','Code-inspection','Admin upstream requests have no application deadline or cancellation budget','Integration reliability',[
  a('lib/api/admin-api-client.ts','response = await fetch'),a('lib/auth/authenticate.ts','response = await fetch'),a('lib/auth/refresh.ts','response = await fetch')],
  'The central admin API client, login and refresh calls await fetch and response decoding without an AbortSignal deadline. Network errors are caught, but a stalled response is not converted to a timely application error.',
  'A stalled backend can tie up admin requests and leave login/mutations waiting for lower-level network timeouts. Concurrent stuck calls consume more resources and worsen recovery.',
  'Inspect the fetch options and body reads at the referenced sites. No hung network server was used; this finding concerns the missing application deadline, not a claim of infinite OS-level socket lifetime.',
  'Add bounded connect/overall request deadlines, cancellation propagation, and consistent timeout error codes. Retry only operations known to be safe/idempotent, within the original deadline. Align auth refresh and UI retry behavior.',
  'Easy','Admin login, refresh, reads and writes');
f('A24','P3','Verified','Backend lint currently fails with 55 errors','Maintainability/check health',[
  b('src/modules/conversations/conversation-migration.integration.spec.ts','booking.rows[0].id'),b('src/modules/conversations/conversation-topics.spec.ts','mock.calls'),b('src/modules/conversations/conversations.controller.ts',"@Param('bookingId'")],
  'The read-only lint invocation reports 52 formatting errors and three unsafe-member-access errors. Errors span conversation source/tests and invoice source/tests. Type checking still passes.',
  'The lint gate is already red, making future new errors harder to distinguish. This does not establish a runtime security flaw.',
  'audit-evidence/backend-lint.txt: 55 errors, zero warnings. Ran eslint without --fix because the repository lint script would modify files. No formatting changes were made.',
  'In the later fix phase, format the affected files and replace the unsafe test result accesses with typed fixtures/results. Keep lint non-mutating in verification commands.',
  'Easy','Developer change validation');
f('A25','P2','Unverified','Word preview has no explicit expanded-document resource budget','Untrusted document processing',[
  a('lib/documents/word-preview.ts','MAX_WORD_PREVIEW_BYTES'),a('lib/documents/word-preview.ts','mammoth.convertToHtml'),a('lib/documents/word-preview.ts','image.readAsBase64String')],
  'The code correctly limits downloaded compressed bytes to 20 MiB and sanitizes preview HTML, but passes DOCX buffers to conversion in-process without an explicit expanded-byte, image-total, entry-count or processing-time budget.',
  'A highly compressed or complex document could consume disproportionate memory/CPU when an administrator previews it. Exploitability and actual library behavior were not measured; this is a resource-exhaustion risk, not a verified ZIP bomb or XSS vulnerability.',
  'Source trace only. No hostile compressed archive was generated or parsed. externalFileAccess:false, restricted image types, sanitization and sandbox CSP are positive controls against different threats.',
  'Before expanding preview usage, test bounded synthetic compression/complexity fixtures in an isolated worker with memory/time limits. Add archive/expanded-content budgets and abortable worker processing or disable inline preview for unsupported cases.',
  'Medium','Admin previews an uploaded Word document');

fs.writeFileSync(path.join(__dirname,'findings.json'),JSON.stringify(findings,null,2));
console.log(JSON.stringify({findings:findings.length,severity:Object.fromEntries(['P0','P1','P2','P3'].map(s=>[s,findings.filter(f=>f.severity===s).length]))}));

const inventory = JSON.parse(fs.readFileSync(path.join(__dirname,'source-inventory.json')));
const routes = JSON.parse(fs.readFileSync(path.join(__dirname,'route-inventory.json')));
const http = JSON.parse(fs.readFileSync(path.join(__dirname,'http-smoke.json')));
const jest = JSON.parse(fs.readFileSync(path.join(__dirname,'backend-tests.json')));
const verified = JSON.parse(fs.readFileSync(path.join(__dirname,'verified-findings.json')));
const count = key => findings.filter(f => f.status === key).length;
const relative = location => location.replace(/^web\//,'').replace(/^backend\//,'../supplyed-backend/').replace(/^admin\//,'../supplyed-admin/');
const link = location => `[${location}](${encodeURI(relative(location))})`;
const md = value => String(value).replaceAll('|','\\|').replaceAll('\n',' ');
const table = (headers, rows) => '\n| '+headers.join(' | ')+' |\n| '+headers.map(()=>'---').join(' | ')+' |\n'+rows.map(row=>'| '+row.map(md).join(' | ')+' |').join('\n')+'\n';
const checks = [
 ['Web lint','npm.cmd run lint','PASS','No errors at baseline; audit helpers excluded from application assessment','web-lint.txt'],
 ['Web types','node node_modules/typescript/bin/tsc --noEmit --incremental false','PASS','No diagnostics','web-types.txt'],
 ['Web tests','node --test tests/*.test.cjs','PASS','9 passed; mostly source assertions plus invoice polling logic','web-tests.txt'],
 ['Backend lint','node node_modules/eslint/bin/eslint.js "src/**/*.ts" "test/**/*.ts" --no-error-on-unmatched-pattern','FAIL','55 errors: 52 formatting, 3 unsafe member access; deliberately no --fix','backend-lint.txt'],
 ['Backend types','node node_modules/typescript/bin/tsc --noEmit --incremental false','PASS','No diagnostics','backend-types.txt'],
 ['Backend tests','node node_modules/jest/bin/jest.js --runInBand --no-cache --json --outputFile=../supplyed-web/audit-evidence/backend-tests.json','PASS / NOT TESTED','347 passed; 52 skipped; 23 passed suites, 2 skipped suites. TEST_DATABASE_URL cleared','backend-tests.json'],
 ['Backend compilation','tsc -p tsconfig.build.json --outDir ../supplyed-web/audit-evidence/backend-build --tsBuildInfoFile ../supplyed-web/audit-evidence/backend-build.tsbuildinfo','PASS','Compiled into isolated audit output; no database boot','backend-build.txt'],
 ['Admin lint','node node_modules/eslint/bin/eslint.js .','PASS','No diagnostics','admin-lint.txt'],
 ['Admin types','node node_modules/typescript/bin/tsc --noEmit --incremental false','PASS','No diagnostics','admin-types.txt'],
 ['Admin tests','node --test tests/*.test.mjs','PASS','13 passed; dropdown/role-profile normalization','admin-tests.txt'],
 ['Web production build','node audit-evidence/build-isolated.cjs web','PASS','next build --webpack; 234.923 seconds; no .env copied; API points to closed loopback port','web-build-result.json'],
 ['Admin production build','node audit-evidence/build-isolated.cjs admin','BLOCKED','next build --webpack failed after 35.852 seconds: network denied while fetching Geist/Geist Mono fonts. Not evidence of a source compile defect','admin-build.txt'],
 ['Dependency audit','npm.cmd audit --json (web); pnpm.cmd audit --json (backend/admin)','BLOCKED','Registry requests denied (EACCES/socket 10013). Selective official Next advisories checked separately; no full dependency clearance','installed-versions.json'],
 ['Secret scan','node audit-evidence/scan.cjs','PASS (limited)','Heuristic source scan: 10 candidates reviewed as false positives; no confirmed credential. No git-history/complete secret-tool scan','secret-scan-redacted.json'],
 ['Local HTTP smoke','node audit-evidence/http-smoke.cjs','PASS','30 page responses and 8 guest BFF checks; mock backend on loopback; no browser execution','http-smoke.json'],
 ['Targeted isolated probes','node audit-evidence/verify-findings.cjs','FAIL (11 defects reproduced)','11/11 probes reproduced their stated behavior; real application methods with mocked persistence/providers','verified-findings.json'],
 ['Browser E2E','Available browser inventory / installed runner check','NOT TESTED','No enabled browser; no installed Playwright/E2E setup suitable for this run. No dependency installed','TEST_MATRIX.md'],
];
const scoreRows = [
 ['Overall','59','Weighted judgment: security 30%, frontend 15%, backend 20%, database 15%, performance 10%, maintainability 10%; 58.75 rounded'],
 ['Security','50','Good default guards and ownership checks, offset by unpatched framework, ineffective session revocation and recovery/CSRF gaps'],
 ['Frontend quality','62','Web build/types/lint pass; important admin auth/create contracts and calendar workflow fail; browser behavior unmeasured'],
 ['Backend/API quality','60','Broad unit coverage, DTOs and transactions; shared auth throttling, timer failure and integration deadlines need correction'],
 ['Database reliability','67','Useful unique/partial constraints and ordered locks; OTP/waitlist races and alert durability gaps; real DB integration tests skipped'],
 ['Performance','60','Pagination, lazy routes and candidate caps exist; all-applicant ranking, serial closure writes and socket state can grow'],
 ['Maintainability','64','Typed modules and reproducible tests/build; backend lint red, duplicated auth contracts and limited end-to-end coverage'],
];
let report = `# SupplyEd application audit

Audit date: 2026-10-28. Application code and bounded local testing only. This report describes the working trees as inspected, including pre-existing uncommitted work. No application fixes, dependency installations, deployments, migrations, production requests or destructive tests were performed.

## Executive summary

**Overall health: 59/100.** The application has substantial implemented functionality and useful security foundations, but it should not be treated as ready for unrestricted growth until the high-priority findings are resolved. There are **25 findings: P0 0, P1 6, P2 18, P3 1**. Evidence classification: **${count('Verified')} Verified, ${count('Code-inspection')} Code-inspection, ${count('Unverified')} Unverified**. The unverified Word-preview risk is included in these totals and is explicitly separated from demonstrated defects.

The most important problems are a vulnerable Next.js version, reusable sessions surviving password recovery, rate limits shared across BFF users, two broken admin workflows, and a backend eligibility gap after required documents are removed. Eleven bounded probes reproduced defects using real application methods with mocked dependencies. The web production build, all three type checks and 369 existing tests passed; 52 backend tests were skipped. Backend lint failed. Admin production build and dependency registry audits were blocked by network restrictions.

No P0 exploit was demonstrated. That does **not** establish absence of critical risk: an upstream Windows RCE advisory also covers the installed Next version under its stated runtime conditions (A01). Public runtime applicability was not investigated, in accordance with the infrastructure exclusion.

## Scores and interpretation

These are engineering judgments, not OWASP certification, vulnerability probabilities, measured test coverage or a production readiness guarantee. Missing runtime coverage reduces confidence; it is not itself counted as a vulnerability.
${table(['Area','Score / 100','Basis'],scoreRows)}

## Scope, architecture and discovery

The selected web repository depends on sibling backend and admin repositories, so both were included as read-only inputs. Mobile was identified as an adjacent consumer and excluded from this website review. Deployment/hosting/AWS account configuration, DNS, TLS installation, reverse proxies and production databases were not audited. Storage signer/provider integration **application code** was reviewed without inspecting infrastructure.
${table(['Repository','Source files inventoried','Source lines','Pages','BFF route files','Backend HTTP methods'],Object.keys(roots).map(repo=>[repo,inventory.filter(x=>x.repo===repo).length,inventory.filter(x=>x.repo===repo).reduce((n,x)=>n+x.lines,0),routes.filter(x=>x.repo===repo&&x.type==='page').length,routes.filter(x=>x.repo===repo&&x.type==='BFF').length,routes.filter(x=>x.repo===repo&&x.type==='API').length]))}

Total: 1,006 source files / 94,901 lines, 51 page routes, 76 Next BFF route files and 176 backend HTTP method declarations. Route discovery is source-derived and not an authenticated live API crawl. NextAuth catch-all GET/POST handlers are included. Socket events and server actions are additional entry points, not included in the HTTP method count. Complete route/file inventories and route-by-route execution status appear in TEST_MATRIX.md and audit-evidence/route-inventory.json.

The web and admin use Next.js App Router, React, TypeScript, Auth.js and TanStack Query. The web uses a component/feature structure, rich text, maps, Socket.IO and Stripe Connect. The backend uses NestJS, Passport/JWT, class-validator DTOs, Prisma/PostgreSQL and scheduled workers. Important integrations are Google ID-token verification, email, phone OTP/Twilio, S3-compatible object storage, Stripe connected accounts/payouts/invoices and signed webhooks. None was exercised against a real account.

Data flows:

1. Browser → Next page/server action/BFF → server-held backend bearer token → Nest global guards/DTO validation → service/repository → Prisma/PostgreSQL. The ordinary browser session deliberately excludes backend access/refresh tokens.
2. Login/OAuth → backend authentication/optional OTP or 2FA challenge → Next encrypted session → refresh through server-side auth code. Password and refresh state are the main weaknesses in this chain.
3. Document/profile/chat attachment → owned upload intent/ticket → signed storage PUT → completion metadata validation and persisted reference → owned download/preview. Web upload byte bounds and document CAS protect normal operations, but direct tickets need stronger resource accounting.
4. Job → application or direct invitation → locked booking transition → invoice/payment provider → signed webhook → reconciled database state and notification creation.
5. Conversation authorization → socket ticket → authenticated participant events; notifications use database records plus scheduled email/matching/reminder workers.

### Roles, permissions and forms

Database roles are ADMIN, INSTRUCTOR, INSTITUTION and USER. Teacher is the web label for INSTRUCTOR. Recruiter-labelled admin areas are not a separate database role. Profile status, signatory approval and user verification provide additional eligibility dimensions.
${table(['Actor','Intended surface','Backend boundary reviewed'],[
 ['Guest','Landing/terms, founding interest, signup/login/recovery, token signatory links','Explicit public routes, OTP-purpose guards and request budgets'],
 ['USER','Account and onboarding toward a role profile','Current JWT user and role; profile creation contract'],
 ['INSTRUCTOR','Teacher profile, jobs/applications, invitations/bookings, reviews, chat, invoices/payouts, calendar','Owner/participant lookup and ACTIVE-profile rules; A06'],
 ['INSTITUTION','School/trust onboarding, jobs, candidate matching, hiring/bookings, invoices, reviews/chat','Owner/poster checks, school eligibility and job/teacher/school locking'],
 ['ADMIN','Users, profiles, jobs, documents/requirements/types, dropdown catalogue, founding interest and conversations','RolesGuard plus backend admin methods; A04/A05/A15 affect client flows'],
 ])}

Form families inventoried/traced include credentials/Google/OTP/2FA/recovery; founding teacher/school; role selection, teacher/school/trust/signatory onboarding; phone verification and document/profile photo upload; settings/security; job create/edit/search/filter; application/proposal/status; direct invitation and booking; reviews; messages/attachments; notification preferences; invoice/payment/payout; admin user/profile/document/catalogue/waitlist CRUD. Their happy paths, rejection cases and remaining runtime checks are listed in the matrix. No claim is made that every individual JSX line or browser interaction was manually exercised.

### Review depth

Every source file was inventoried and included in the broad static pattern scan (278 matches). Controllers/routes, auth boundaries, principal business services, related repository/DTO/schema paths and critical client contracts received targeted manual inspection. Database models/migrations were inspected for constraints, indexes, ownership, deletion and transaction behavior. This is systematic breadth plus deeper risk-based tracing, **not a claim of exhaustive line-by-line manual review of all 94,901 lines**. Pure presentation variants, all responsive breakpoints and all component lifecycle combinations remain a coverage gap.

## Automated and local test results
${table(['Check','Command / method','Result','Actual outcome','Evidence'],checks.map(x=>[...x.slice(0,4),x[4]==='TEST_MATRIX.md'?'[TEST_MATRIX.md](TEST_MATRIX.md)':`[${x[4]}](audit-evidence/${x[4]})`]))}

Commands were run from their respective repositories unless the command itself is an audit helper in web. Existing tests total **369 passed (9 web + 347 backend + 13 admin), zero failed, 52 skipped**. The audit probes intentionally assert broken behavior and are separate from repository regression tests. A probe running successfully means its defect was reproduced, not that the product passed.

Build copies omitted .env files, used random temporary auth secrets and a closed loopback API address; Next builds used **--webpack**, so the default Turbopack production build was not verified. The local web server used a second loopback mock returning unavailable catalogue data and denying protected API access. Thirty page response checks passed, including Next streaming redirects; HTTP 200 with NEXT_REDIRECT was not misreported as an auth bypass. Eight guest BFF checks returned the expected 200 empty-session / 401 private responses. These checks establish local routing/headers, not backend authorization against real users. Admin runtime pages were not exercised.

Local guest request timings are a small sequential smoke sample, with no real database, provider or browser rendering. They are not a benchmark, capacity estimate, Lighthouse score or Core Web Vitals measurement. Build duration includes local environment overhead. No public service was load-tested.

### Coverage limitations

- 52 database-backed tests were skipped because no explicitly isolated disposable database was configured: 47 school/chat/direct-hire cases, four security integration cases and one conversation migration case. The passing redaction cases in the mixed security suite do not imply its database cases ran.
- No browser automation was available. Hydration, keyboard/focus behavior, screen-reader semantics, responsive layouts, browser-back/refresh state, real cookies/CSRF, OAuth redirects, long-lived sessions and duplicate UI clicks remain NOT TESTED at E2E level.
- No PostgreSQL migration execution, query plan/EXPLAIN, realistic load, transaction-contention test, real storage upload, SMTP/Twilio delivery, Stripe sandbox call or live webhook replay was performed. Mock-based evidence is labelled at each finding.
- Dependency audit commands could not contact their registry. Official advisories were checked selectively for installed Next versions; this is not a full direct/transitive dependency vulnerability inventory. The Pages Router cache-poisoning advisory was not applied to this App Router application. No unsupported RCE claim was made for the disabled web image optimizer.
- Secret scanning was a custom current-source heuristic with redacted output, not a complete historical or high-entropy scanner. Ten candidates were validation strings/endpoint identifiers. .env files were untracked; values were not included in reports or used for runtime tests. A clean scan is not proof of no leaked secrets.
- No infrastructure conclusions, penetration-test certification or assertion of complete security is provided.

## Controls reviewed and false positives avoided
${table(['Control area','Observed evidence / conclusion','Limits'],[
 ['Default authentication/roles','AppModule registers global JWT and role guards; explicitly public/OTP routes are separated; backend loads current role from the user','No complete live role matrix'],
 ['JWT/2FA','Separate required secrets and token purposes; bcrypt password hashing; 2FA encrypted secret/recovery hashes and challenge/replay controls','Session revocation and OTP atomicity remain A02/A07'],
 ['Google identity','Verified Google ID-token audience/email status; no automatic linking to an existing email account','Provider not called; A16 continuation issue'],
 ['BOLA/IDOR','Document ownership, conversation participant, job poster, application/invoice ownership checks traced; admin methods require role','No confirmed arbitrary cross-user read/write; live cross-tenant tests skipped'],
 ['SQL injection/mass assignment','Prisma/tagged parameterized raw SQL, DTO validation and explicit service field selection in inspected paths','Not a formal proof for every possible payload; no SQL injection demonstrated'],
 ['XSS/preview','DOMPurify rich-text sanitization; Word sanitization, externalFileAccess:false and sandbox CSP; download filename encoding','No confirmed XSS; browser attack corpus not executed; A19/A25 remain'],
 ['CSRF/redirects','Next server action checks plus explicit origin checks on several BFF mutations; invitation return-path filtering','A11 is an ordinary route exception; cookie delivery untested'],
 ['SSRF/path traversal','Storage keys are generated/ownership constrained; preview obtains backend-generated storage references in inspected paths','No external URL attack test; no confirmed SSRF or traversal'],
 ['Uploads','Owned keys, If-None-Match immutability, completion HEAD checks, replacement/review CAS and bounded web multipart readers','A18 pre-completion resources; metadata MIME alone is not file-content validation'],
 ['Payment integrity','Raw-body Stripe signature verification, event deduplication and monotonic invoice transitions; invoice amounts computed from booking terms','No sandbox run; payout intent identity A10'],
 ['Database integrity','Unique application per teacher/job, booking/application links, partial uniqueness for occupied job bookings/pending invitations, shared lock order, review aggregate locks','No real contention/migration validation; A07/A20/A22'],
 ['Caching/data isolation','Private no-store BFF responses; per-user query/session paths reviewed; route shell authenticates before private data','No multi-browser cache-isolation E2E'],
 ['CORS/logging/errors','No permissive HTTP CORS enablement found; socket origin policy and bearer auth; exception mapping and redaction helpers inspected','Native no-Origin socket clients still require credentials; no complete production log review'],
 ['Frontend structure','Lazy page imports and explicit loading/error states; existing accessibility source checks pass','Source assertions do not prove keyboard, layout or screen-reader correctness'],
 ])}

## Findings register

Severity follows the requested scale: P0 critical exploitable serious failure; P1 high core security/integrity/functionality risk; P2 medium correctness/reliability/performance issue; P3 low maintenance issue. **Verified** means the precisely described local behavior was executed, often with mocks. **Code-inspection** means the path supports the finding but the complete runtime scenario was not reproduced. **Unverified** means plausible risk requiring further controlled validation.

Path prefixes below map to web = supplyed-web, backend = ../supplyed-backend, admin = ../supplyed-admin. Line numbers refer to the inspected working tree and can move after later edits.
${table(['ID','Priority','Status','Finding'],findings.map(f=>[f.id,f.severity,f.status,f.title]))}
`;
for (const item of findings) report += `\n### ${item.id} — ${item.title}\n\n- **Severity / status:** ${item.severity} / ${item.status}\n- **Category:** ${item.category}\n- **Affected component and exact locations:** ${item.locations.map(link).join('; ')}\n- **Explanation:** ${item.explanation}\n- **Impact:** ${item.impact}\n- **Evidence / safe reproduction:** ${item.evidence}\n- **Recommended fix:** ${item.fix}\n- **Estimated difficulty:** ${item.difficulty}\n- **Affected journey:** ${item.journey}\n`;
report += `
## Missing safeguards and 3–12 month risks

The concrete missing safeguards are already counted once in the register: persisted/revocable sessions (A02), aligned end-user throttling (A03), transactional current eligibility (A06), atomic recovery consumption (A07), explicit payout intents (A10), consistent mutation-origin checks (A11), bounded socket state (A12), caught scheduled work (A13), durable notification leases (A14), complete admin refresh coverage (A15), pending-upload accounting (A18), browser security policy (A19), unique waitlist business keys (A20), bounded ranking/transaction work (A21/A22), upstream deadlines (A23), and isolated preview budgets pending verification (A25).

Growth will make A03 visible first: very few concurrent registrations can exhaust a shared BFF bucket. Popular jobs amplify A21/A22; more long-lived chats amplify A12; worker interruptions expose A14; recurring teacher balances expose A10. Increased uploads/Word previews amplify A18/A25. An admin left open longer exposes A15/A23. These are projected consequences of specific code paths, not measured production incidents.

Maintenance priorities beyond counted defects are broader integration coverage, a shared frontend/backend auth contract, and extracting well-defined responsibilities from large onboarding/post-job/messaging modules when changing them. Size alone is not a bug. Auth.js beta versions differ across web/admin and provider SDK versions should be covered by upgrade regression tests; no unsupported claim of a beta-specific vulnerability is made. The admin build currently requires external font fetching, so a fully offline build needs an explicit asset strategy; its failure here is an environment limitation rather than a counted source defect.

Document type/expiry policy needs a product decision: define which evidence must remain valid for each action and how expiring/rejected files affect already-confirmed bookings. File content validation/quarantine should be evaluated according to accepted file types and preview use. No malware execution, legal noncompliance or content-type XSS was demonstrated.

## Prioritized remediation roadmap

This is a recommendation only; no fixes were authorized or applied in this phase.
${table(['Order','Items','Action and acceptance evidence'],[
 ['1 — immediately','A01','Patch both Next applications; repeat full dependency audit when registry access is available, web/admin build and action/auth smoke tests. Do not wait for exploit reproduction'],
 ['2 — immediately','A02, A07, A08, A09','Make recovery revoke sessions and consume codes atomically; remove public identity disclosure; align hash/length policy. Use real disposable-DB concurrent tests and old-token rejection tests'],
 ['3 — immediately','A03, A06','Fix BFF-aware rate budgets and enforce backend eligibility. Test multiple users through one BFF and ACTIVE users after required-document deletion'],
 ['4 — restore core admin access','A04, A05, A15, A16','Complete 2FA/social continuations, align user-create contract and cover all refresh routes. Run browser expiry/2FA/creation tests'],
 ['5 — payments and browser boundaries','A10, A11, A19','Persist payout intents, add consistent origin checks and deploy an application header policy through a reviewed source change. Verify Stripe sandbox retry/repeated-balance behavior and real cookie tests'],
 ['6 — recovery/resource reliability','A12, A13, A14, A18, A23','Bound socket/upload resources, catch timer errors, add durable alert leases and deadlines. Test interruption/reclaim/cancellation without external load'],
 ['7 — functional/data correctness','A17, A20','Implement real calendar persistence; enforce waitlist uniqueness after checking duplicate-resolution rules. Test reload/back-navigation and concurrent submissions'],
 ['8 — before larger datasets','A21, A22, A25','Bound ranking and closure work; validate preview risk with isolated small fixtures before adding resource limits. Measure real database plans and transaction budgets'],
 ['9 — restore quality gate, then repeat audit','A24 and coverage gaps','Resolve lint; run the 52 skipped tests against a disposable DB, complete browser role/journey matrix, finish admin build and dependency audit. Review findings after fixes'],
 ])}

## Top ten priorities

1. A01: patch the vulnerable Next.js versions in both applications.
2. A02: revoke and rotate backend sessions during recovery/logout.
3. A03: stop unrelated BFF users sharing the tiny authentication rate budget.
4. A06: enforce current required-document eligibility in backend hiring operations.
5. A04: allow administrators with 2FA to log in.
6. A05: repair the admin create-user request contract.
7. A10: give every withdrawal a durable, unique business-operation ID.
8. A07: consume recovery OTPs atomically with the password change.
9. A11: enforce same-origin/CSRF protection on instant payout.
10. A14: replace the pre-delivery sent timestamp with reclaimable alert work.

## Evidence and preservation

See [TEST_MATRIX.md](TEST_MATRIX.md), [AUDIT_PLAN.md](AUDIT_PLAN.md), [findings.json](audit-evidence/findings.json), [source inventory](audit-evidence/source-inventory.json), [route inventory](audit-evidence/route-inventory.json), [probe results](audit-evidence/verified-findings.json), [HTTP smoke](audit-evidence/http-smoke.json) and the individual logs in audit-evidence/. Audit helper scripts remain available for inspection/reproduction; they are not application fixes. Run them only in the same safe isolated conditions. No existing tests or source were rewritten to make checks pass.

The preservation check compares SHA-256 hashes of all 1,006 baseline inventoried source files. See [preservation-check.json](audit-evidence/preservation-check.json) for the final result. Generated build copies and the temporary loopback processes are removed/stopped after evidence collection, so copied source cannot affect normal TypeScript discovery. The original node_modules directories are retained. Existing tracked/untracked user work is preserved.
`;
fs.writeFileSync(path.join(root,'AUDIT_REPORT.md'),report);

const pending = [];
function journey(feature, scenarios, expected, reason = 'No browser plus disposable backend/database/provider fixture; source review is not E2E execution.') {
  for (const scenario of scenarios) pending.push([feature, scenario, expected,'NOT TESTED — '+reason,'NOT TESTED','Related route/source inventory; AUDIT_REPORT.md coverage limits']);
}
journey('Public pages / accessibility',[
 'Landing, how-it-works, terms and founding pages on phone/tablet/desktop',
 'Keyboard-only navigation, focus restoration, dialog trapping and screen-reader announcements',
 'Images, maps, rich text, reduced motion and browser compatibility',
 'Catalogue unavailable, empty results and page hydration after SSR',
], 'Correct readable layout and navigation; accessible interaction; graceful loading/error/empty state.');
journey('Signup / email OTP',[
 'Teacher and school signup with fresh normalized emails',
 'Existing verified versus unverified email and permitted role handling',
 'Invalid email/weak password/long Unicode password and direct API validation',
 'Wrong, expired, exhausted and replayed email OTP',
 'Resend cooldown, delayed email and network interruption',
], 'Only verified, intended accounts progress; invalid attempts are bounded and recoverable.');
journey('Login / session',[
 'Valid and invalid email/password including unverified account',
 'Browser logout, back button and private-cache isolation',
 'Access expiry with one tab, multiple tabs and concurrent refresh',
 'Deleted/demoted user and suspended profile with old session',
 'Teacher attempts institution route; institution attempts teacher route; either attempts admin',
], 'Fail closed with current authorization, safe redirects and no stale private data.');
journey('Google / 2FA / recovery',[
 'Google audience/email mismatch and existing-email linking rejection',
 'Google login with and without enabled 2FA',
 'TOTP setup, invalid code, replay, disable and recovery-code regeneration',
 'Recovery code is accepted once under simultaneous requests',
 'Password recovery end-to-end with delivered OTP and session revocation',
], 'Verified identity plus required factors; single-use challenges and safe recovery.');
journey('Onboarding / profile',[
 'Teacher details, qualifications, documents and submission lifecycle',
 'Single school versus MAT school/trust selection and signatory approval',
 'Phone OTP send/verify/change and international number validation',
 'Profile image upload, reload and URL refresh after signed URL expiry',
 'Required document deletion/replacement after approval then direct API mutation',
 'Expired/rejected/pending evidence and suspension during an active session',
 'Refresh/back navigation and duplicate onboarding submit',
], 'Persist consistent profile state; enforce current eligibility in backend; retain recoverable form data.');
journey('Signatory approval',[
 'Valid, expired, tampered, already-decided and resent approval token',
 'Approve versus decline and concurrent conflicting decisions',
 'Admin override and trust identity changes',
], 'Only authorized live token/admin can decide; one consistent final decision.');
journey('Documents / uploads',[
 'Owned create/upload/complete/download/delete with normal file',
 'Cross-user document ID and swapped storage key',
 'Mime mismatch, zero-byte, oversize, multiple-file and truncated multipart',
 'Abandoned upload and complete request repeated after successful upload',
 'Replace file while admin approves old file; duplicate reviewers',
 'PDF/image/Word preview content escaping and download headers',
], 'Bound bytes/resources; deny nonowners; preserve immutable evidence and review consistency.');
journey('Jobs / search',[
 'Create draft, edit, validate and publish with correct work-unit/pay terms',
 'Invalid date ranges, past start, missing subject/required fields',
 'Browse/search/filter/sort/paginate across empty and large datasets',
 'Reserved/filled/expired/suspended/unapproved-school visibility',
 'Edit material terms after applications/invitations/bookings exist',
 'Close/reopen/delete and concurrent apply/close',
], 'Consistent public visibility, authorized ownership and immutable agreed terms.');
journey('Applications / matching',[
 'Apply once, duplicate click, duplicate concurrent request and withdraw',
 'Cross-user application detail and school applicant list',
 'Viewed/shortlisted/rejected/accepted legal and illegal transitions',
 'Rank applicants with distance/availability/subject edge cases and missing coordinates',
 'Large applicant pages and candidate cap fairness',
], 'One application per teacher/job; current eligibility, stable ranking and bounded query work.');
journey('Direct hire / bookings',[
 'Create, accept, decline, cancel and expire a direct invitation',
 'Concurrent accepts for one job and overlapping teacher bookings',
 'Application acceptance versus direct invitation competing for same position',
 'Suspend/delete/close during invitation acceptance',
 'Booking details, dates/partial days, completion and cancellation permissions',
], 'Exactly one valid occupied job position; consistent agreed terms and overlap policy.');
journey('Reviews',[
 'Eligible completed booking, reciprocal reviews and duplicate submission',
 'Other user/booking spoofing, invalid stars, edit/delete ownership',
 'Concurrent review writes preserve rating aggregate',
], 'Only eligible participants review once per side; aggregates remain correct.');
journey('Messaging',[
 'General, application and booking topic creation and history cursor pagination',
 'Nonparticipant attempts message/read/download/socket ticket',
 'Send/retry/double-click, reconnect and unread count synchronization',
 'Typing/read throttle across valid and random conversation IDs',
 'Attachments, content types, size limits, abandoned upload cleanup',
 'Role/account changes and backend outage during live connection',
 'Conversation migration retains history and prevents duplicate canonical threads',
], 'Participant isolation and reliable ordered messaging with bounded resources.');
journey('Notifications',[
 'In-app unread count, mark-one/all read, preferences and pagination',
 'Job-match creation/deduplication and worker crash/reclaim',
 'Email retry/daily caps/stale leases and message reminder suppression',
], 'No cross-user leakage; durable idempotent delivery and explicit retry exhaustion.');
journey('Billing / payments',[
 'Connect account onboarding, incomplete requirements and return refresh',
 'Invoice creation from agreed terms, rounding and fee/currency boundaries',
 'Payment success/failure/required action and duplicate user requests',
 'Signed/invalid/duplicate/out-of-order webhook and provider retry',
 'Refund/void/payment state convergence and invoice ownership',
 'Instant payout recurring balance, changed destination, retry and timeout',
 'Real browser cross-site/sibling-origin cookie delivery to payout route',
], 'Authorized immutable money intent, integer-safe amounts, no duplicate business operation and monotonic reconciliation.', 'No real Stripe sandbox, disposable DB or browser; only isolated payout method/route probes were run.');
journey('Settings / calendar',[
 'Profile/security updates and cross-tab cache invalidation',
 'Calendar month boundaries, real booked days, availability save/reload',
 'All preference toggles persist and affect relevant matching behavior',
], 'Accurate persisted state and clear failure feedback; calendar source defect A17.');
journey('Administration',[
 'Admin password/2FA login, unauthorized non-admin denial and logout',
 'User create/edit/delete, generic USER versus role assignment and self-demotion constraints',
 'Teacher/school approve/reject/suspend and current workspace behavior',
 'Document types/requirements/catalogue/dropdown CRUD and referenced-item deletion',
 'Document review/preview/download and simultaneous file replacement',
 'Waitlist status/filter/export and CSV content edge cases',
 'Long-idle session mutation on every BFF route, including omitted matchers',
], 'Only current admins perform validated operations; clear recoverable errors, consistent auth refresh.');
journey('Resilience / data / performance',[
 'Disposable-database migrations and populated-data integrity',
 'Real DB concurrent reset/booking/review/waitlist transactions',
 'Provider/network timeouts, malformed upstream responses and retry budgets',
 'Large datasets: applicant ranking, job closure, exports and notification backlog',
 'Browser memory after repeated navigation, subscriptions and socket reconnect',
 'Lighthouse/Core Web Vitals, asset waterfalls, bundle loading and image expiry',
 'Bounded DOCX expanded-content complexity in isolated worker',
], 'Bounded work, consistent data and recoverable failure; no resource leaks or uncontrolled retries.', 'No disposable DB/browser/load fixture; source analysis identifies risks but supplies no measured runtime pass.');

let matrix = `# SupplyEd test matrix

Audit date: 2026-10-28. Companion to [AUDIT_REPORT.md](AUDIT_REPORT.md). Every row separates the test expectation from the actual observation. **PASS** means only the described bounded check passed. **FAIL** includes a reproduced defect or a failed existing check. **BLOCKED** means a check was attempted but its required environment failed. **NOT TESTED** means the listed runtime journey was not executed, even if its code or a related unit test was reviewed.

No browser E2E journey is claimed to pass. The only running website was an isolated web production build on loopback with an auth-denying mock backend; no real accounts, providers, production database or external application endpoint was used. Existing tests use fixtures/mocks unless explicitly marked as skipped database integration. Source-supported findings use their own status in the report and do not convert the planned E2E rows into passes.

## Existing checks and build/tool availability
${table(['Feature / check','Test scenario','Expected behavior','Actual behavior','Result','Evidence'],checks.map(x=>[x[0],x[1],'Check completes successfully without modifying application source',x[3],x[2],x[4]]))}

## Executed targeted defect probes

All persistence/provider dependencies are mocked; real service/BFF/validator code is loaded by audit-evidence/verify-findings.cjs. Real bcrypt and JWT signing/verification are used for recovery. No defect probe is a real database, browser or provider test.
${table(['Feature / flow','Test scenario','Expected behavior','Actual behavior','Result','Evidence'],verified.map(v=>{
 const mapping={
  'AUTH-REVOCATION':['Session recovery','Old session rejected after reset','A02'],
  'OTP-CONCURRENCY':['Password reset','One code permits exactly one password change','A07'],
  'RESET-ENUMERATION':['Public recovery','Unknown and existing accounts have indistinguishable responses','A08'],
  'BFF-RATE-BUDGET':['Signup throttle','Different users do not exhaust a tiny shared BFF allowance','A03'],
  'PAYOUT-KEY-COLLISION':['Instant payout','Distinct withdrawal intents have distinct retry identities','A10'],
  'SOCKET-UNBOUNDED-MAPS':['Messaging','Distinct invalid IDs cannot grow unbounded state/work','A12'],
  'ADMIN-2FA':['Admin login','A valid challenge has a completion path','A04'],
  'PAYOUT-ORIGIN':['Payout BFF','Untrusted-origin text/plain mutation is rejected at route boundary','A11'],
  'PASSWORD-72-BYTES':['Password input','All accepted password bytes influence authentication','A09'],
  'WAITLIST-DUPLICATE':['Founding interest','Duplicate concurrent business requests are idempotent','A20'],
  'ADMIN-USER-ROLE-CONTRACT':['Admin users','BFF forwards a request accepted by backend DTO','A05'],
 };const m=mapping[v.id];return [m[0],v.id,m[1],v.evidence,'FAIL',m[2]+'; verified-findings.json'];
}))}

## Executed local guest page/BFF checks

Only GET responses were checked. A streamed login redirect within HTTP 200 is valid Next behavior and is not an authorization bypass. No DOM interaction, hydration or authenticated screen was tested. The invalid signatory fixture only tests safe rendering; it does not verify token decisions. Cache headers on BFF responses were recorded. The mock returning 401 prevents this from proving the real Nest authorization boundary.
${table(['Feature / flow','Test scenario','Expected behavior','Actual behavior','Result','Evidence'],http.map(h=>[h.route,'Guest GET, isolated production web build',h.expected,h.status+(h.streamedLoginRedirect?' with streamed login redirect':'')+(h.location?' → '+h.location:'')+(h.cacheControl?'; '+h.cacheControl:''),h.pass?'PASS':'FAIL','http-smoke.json']))}

Missing general HTML headers are separately a **FAIL**, A19, even though the route/status checks above passed. All checked page response header objects record the absence. Admin header behavior was not run.

## End-to-end journey backlog and explicit coverage gaps

These ${pending.length} scenarios cover meaningful roles, forms, state transitions and failure paths discovered in source. They remain NOT TESTED at E2E level. Passing related unit/source tests below must not be substituted for this coverage. Prioritize the high-severity findings and the skipped database suite first when a safe test environment is provided.
${table(['Feature / flow','Test scenario','Expected behavior','Actual behavior','Result','Evidence'],pending)}

## Existing backend suite accounting

Jest reports 347 passed tests and 52 pending/skipped tests. A mixed suite can have passing non-DB assertions and skipped DB cases; it is shown as PARTIAL. Suite names are evidence of what ran, not a claim of branch coverage. No coverage percentage was collected.
${table(['Suite','Passed assertions','Skipped assertions','Result','Evidence'],jest.testResults.map(s=>{const passed=s.assertionResults.filter(a=>a.status==='passed').length;const skipped=s.assertionResults.filter(a=>a.status==='pending').length;return [s.name.split('supplyed-backend')[1].replaceAll('\\','/'),passed,skipped,skipped?(passed?'PASS / NOT TESTED':'NOT TESTED'):'PASS','backend-tests.json'];}))}

Web: nine node:test cases cover accessibility/cache source contracts and invoice polling behavior; these are not rendered-browser accessibility tests. Admin: thirteen node:test cases cover dropdown and role-profile normalization. Full names and individual outcomes are retained in web-tests.txt and admin-tests.txt.

## Complete discovered page route inventory

This inventory contains 30 web pages and 21 admin pages. Protected page guest responses passing does not prove the corresponding authenticated journey. All authenticated page interaction remains NOT TESTED.
${table(['App','Route','Source','Guest response execution','Authenticated/user interaction'],routes.filter(r=>r.type==='page').map(r=>{const hit=http.find(h=>h.route===r.route.replace('[token]','audit-fixture-invalid'));return [r.repo,r.route,r.path,r.repo==='web'&&hit?'PASS — '+hit.status+(hit.streamedLoginRedirect?' streamed redirect':''):'NOT TESTED — admin build/browser unavailable','NOT TESTED'];}))}

## Complete discovered BFF route inventory

76 route files. The status applies to GET only where listed; mutation methods were not sent through a live session. A05/A11 additionally have isolated handler probes, documented above. NextAuth catch-all handlers may serve multiple internal auth endpoints.
${table(['App','Route','Methods','Source','Runtime result'],routes.filter(r=>r.type==='BFF').map(r=>{const hit=r.repo==='web'&&http.find(h=>h.route===r.route);const auth=r.repo==='web'&&r.route.includes('[...nextauth]');return [r.repo,r.route,r.methods.join(', '),r.path,hit?'PASS — guest GET only '+hit.status:auth?'PASS — guest /api/auth/session GET only':'NOT TESTED — no authenticated integration runtime'];}))}

## Complete discovered backend HTTP method inventory

176 method declarations under the configured /api prefix. All were inventoried and their guard/controller patterns scanned; none was exercised over HTTP against a real backend/database in this audit. Related unit and isolated service probes do not change these rows to PASS. Use the source line to locate DTO/role/ownership handling. Public exceptions, OTP-purpose paths, webhook signature paths and admin-role paths were traced selectively as described in the report.
${table(['Method','Endpoint','Source line','Expected boundary','Execution'],routes.filter(r=>r.type==='API').map(r=>[r.method,r.route,r.path+':'+r.line,'Global JWT/roles unless explicit public/OTP/signature exception; operation-specific ownership and DTO','NOT TESTED — no disposable backend/DB']))}

## Reproduction and evidence handling

- Existing commands and outcomes are in the first table. The backend npm lint script includes --fix; the audit intentionally used a direct non-fixing eslint command.
- The isolated build helper uses installed dependencies and copies only source/config/assets, never .env. Its temporary copies have been removed after collection. Re-running it recreates them and requires cleanup because the original TypeScript project includes nested source files.
- http-smoke.cjs requires the isolated web build and local-runtime.cjs fixture server, with ports 4317/4320 bound only to 127.0.0.1. These processes were stopped after collection.
- verify-findings.cjs can be inspected without executing. It uses generated secrets, example.test identities, mocked persistence/providers and small bounded inputs. It changes no application/database records.
- Dependency audit failure logs are named *-dependencies.json but contain command error output, not a valid successful vulnerability report. Do not interpret them as an empty vulnerability list.
- Evidence files may contain synthetic test emails and local source paths. Credential values are not included. Preservation and cleanup results are recorded separately.
`;
const actions=[];
for (const sourceFile of inventory.filter(x=>x.repo!=='backend'&&/\.tsx?$/.test(x.path))) {
  const source=fs.readFileSync(path.join(roots[sourceFile.repo],sourceFile.path),'utf8');
  if(!/^\s*["']use server["']/.test(source))continue;
  const lines=source.split('\n');
  lines.forEach((line,index)=>{const match=/export\s+(?:async\s+function|const)\s+(\w+)/.exec(line);if(match)actions.push({repo:sourceFile.repo,path:sourceFile.path,line:index+1,name:match[1]});});
}
fs.writeFileSync(path.join(__dirname,'server-action-inventory.json'),JSON.stringify(actions,null,2));
matrix += `\n## Additional framework and socket entry points\n\nThese are outside the controller-method count. Swagger setup in backend/src/main.ts registers /api/docs plus its UI assets, /api/docs-json and /api/docs-yaml; no runtime request was made. Their existence alone is not classified as a vulnerability. NextAuth internal endpoints are served by the two catch-all route files listed above. Socket namespace /conversations handles authenticated connection/disconnect, inbound typing/read, and outbound message/read/typing/auth-expired events; actual live socket behavior is NOT TESTED. The bounded onRead method probe is A12.\n\nThe following exported declarations were found in top-level use-server modules. This is a source inventory, not a live Next action-ID map; inline actions and generated Auth.js handlers are additional framework behavior. Each actual authenticated browser submission remains NOT TESTED.\n${table(['App','Export','Source line','Execution'],actions.map(x=>[x.repo,x.name,x.path+':'+x.line,'NOT TESTED — no browser/authenticated backend']))}`;
fs.writeFileSync(path.join(root,'TEST_MATRIX.md'),matrix);
console.log(JSON.stringify({reportWords:report.split(/\s+/).length,matrixScenarios:pending.length,matrixLines:matrix.split('\n').length}));
