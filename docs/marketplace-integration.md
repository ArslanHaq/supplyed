# Jobs, applications and full verification

Implemented for instructor, school and hirer accounts. The original backend API contracts are preserved except for the explicitly requested full-verification field and posting/application policy.

## Verification contract

`User.isFullyVerified` is returned by user/auth response DTOs. It is read-only and defaults to false. PostgreSQL migration `20260918140000_add_user_full_verification` adds the column, backfills existing users, and maintains it with triggers when user, profile, document, requirement or document-type records change.

It is true only when:

- Email and phone are verified and the phone is nonblank.
- The account's matching instructor, institution or recruiter profile is ACTIVE.
- Every non-deleted owned document, including application documents, has an uploaded file and status APPROVED.
- Every active required profile requirement with an active document type has an uploaded, approved profile document.

No document requirement means no missing required document. Optional uploaded documents still require approval. NOT_REQUIRED is deliberately not APPROVED. Under the existing document service a NOT_REQUIRED file cannot be reviewed: an administrator must enable review on its requirement and the owner must upload a replacement to enter PENDING. Deleted required documents revoke verification until replaced; inactive requirements do not impose missing-file requirements.

The access-token strategy reloads the database value on every protected request. Unverified profile accounts may browse public jobs, read existing applications, edit their profile/documents and manage existing job fields. They cannot create jobs, publish/reopen jobs with status ACTIVE, or create applications. Existing administrator job-management permissions are retained. Application status updates retain their existing ACTIVE-profile rule.

The frontend uses the server field for its Verified badge and gates. Profile approval, DBS status, document approval and full account verification remain separate. Phone verification uses the existing administrator process; no new phone OTP service was added.

## Frontend flows

- Instructors create a profile, manage documents, submit for review, browse jobs, apply once fully verified, then use My applications for paginated statuses, history and supporting documents.
- Schools create a profile and submit for review, complete verification, create a draft and publish it, select an owned role, review applications and move candidates through only supported transitions.
- Hirers create the recruiter profile (immediately ACTIVE), complete the remaining verification checks, and use the same posting and review flow. The institution-only document catalogue is never requested for hirers.
- Incomplete, rejected, pending and suspended profiles retain workspace access. Profile resubmission is shown only for INCOMPLETE, REJECTED and DEACTIVATED.
- Jobs are loaded from the public list for discovery and from `/jobs/mine` for editing. Public job expiry can occur while the stored status remains ACTIVE; owner lists display that as expired.
- Publishing failure after creation preserves the saved draft and opens its editor rather than prompting creation of a duplicate.
- Empty skill/key-stage arrays are retained on PATCH. Writable payload fields are explicitly selected. Job pay uses a GBP display convention and does not send a currency field.
- Application cover letters are optional, at most 2,000 characters. Hiring closes the role and refreshes jobs/applications/matching queries.
- Supporting documents are uploaded only after an application exists. The available application catalogue is not presented as a job-specific checklist, which the current API cannot provide. Schools/hirers cannot review applicant documents through owner document routes.
- Recommendations use the supported per-job matching APIs. The original preview dashboard statistics, activity, teacher directory, profile samples, quick actions and illustrative map are retained at the product owner's request. Live per-job recommendations remain available alongside the preview directory.

## Validation

Frontend: `npm run build`, `npx tsc --noEmit`, `npm run lint`, `node scripts/check-marketplace.cjs`.

Backend: `pnpm exec tsc --noEmit`, `pnpm exec jest --runInBand`. Local database lifecycle checks: set `VERIFICATION_DB_TEST=1` and run `pnpm exec jest --runInBand common/profile/full-verification`. These tests run inside rolled-back transactions and reject non-local/production databases.

Deploy the schema with `pnpm exec prisma migrate deploy` and generate the client with `pnpm exec prisma generate`. Apply the migration before running the updated backend. The migration was applied to the configured local database; no remote deployment was performed.

## Posting and application forms

- Job posting exposes every writable CreateJob field, including paired latitude/longitude, and prefills the hiring profile address. The original posting mode, urgency and QTS controls are preserved as description notes. Draft/publish sets status using the supported update route.
- Applications select the job automatically and accept an optional cover letter. The form also prefills all editable instructor details, including biography, skills, subjects, stages, rates, experience, address, postcode, country, currency and travel radius. Profile changes save before application creation; existing values are retained. Instructor coordinates are derived from postcode by the backend and are not client-writable.
- IDs, ownership, audit timestamps, verification flags, ratings and initial application status are assigned by the server. Supporting documents attach after application creation. Application status management and history remain in the applications screens.
- The account badge reads `Verified`; eligibility continues to use the server's `isFullyVerified` flag.

- New job forms automatically request browser geolocation permission and fill both coordinates. Existing job coordinates are preserved. Applications reuse the saved account photo and do not include a photo picker.
