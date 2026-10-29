# School onboarding approval

MAT schools use the existing trust signatory approval. Single schools use a separate compliance approval. Both still require the existing documents and SupplyED admin review before workspace access.

## Onboarding

| School type | Approval details | Public page |
| --- | --- | --- |
| MAT school | Signatory name, email, and job title | `/signatory-approval/[token]` |
| Single school | Compliance name and email | `/compliance-approval/[token]` |

The approval email must differ from the account owner's email. Both paths retain safeguarding confirmation. Hidden fields from the other school type are excluded from onboarding validation and payloads.

After profile creation, required documents can be uploaded while approval is pending. The approval card supports status refresh, contact corrections, and resending. Approval unlocks submission for admin review; it does not activate a school automatically. Existing MAT endpoints and links are unchanged.

## Backend models

- `ComplianceApproval` is a new table related to `InstitutionProfile`. It stores the compliance name/email at request time, a SHA-256 token hash, expiry, status, creation/update times, decision time, optional decline reason and request metadata, and the terms version. Raw link tokens are sent by email and never returned in API responses or stored in the table.
- `InstitutionProfile.complianceApprovalRequired` is a backend-controlled boolean, defaulting to `true`, and `complianceApprovals` is its new relation. Clients cannot set the requirement flag through profile DTOs.
- The existing `SignatoryApprovalStatus` enum is reused for the same lifecycle: `PENDING`, `APPROVED`, `DECLINED`, `EXPIRED`, and `REVOKED`. The existing signatory table and trust relationship are unchanged.
- Teacher, job, payment, and document models are unchanged by this feature.

The migration marks existing single schools in `PENDING`, `ACTIVE`, or `SUSPENDED` as exempt. Existing incomplete/rejected applications and new schools require compliance approval. A legacy single school returned to incomplete/rejected onboarding becomes subject to approval before resubmission.

## New backend endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/institutions/me/compliance-approval` | Owner reads the latest request, or `null` |
| POST | `/institutions/me/compliance-approval` | Owner requests/resends using the saved compliance contact; empty body |
| GET | `/compliance-approvals/token/:token` | Public school review and compliance terms |
| POST | `/compliance-approvals/token/:token/approve` | Public approval with `{ "acceptTerms": true }` |
| POST | `/compliance-approvals/token/:token/decline` | Public decline with `{ "reason": "..." }`, 1–1,000 characters |

The web app proxies public requests through `/api/compliance-approvals/[token]`. Its POST body uses `action: "approve"` or `action: "decline"` with the corresponding fields above. The proxy enforces same-origin POSTs and token format checks.

Owner snapshots add `complianceApproval`; institution snapshots expose `complianceApprovalRequired`. Public review returns school details, the compliance name, requester email, status, expiry, terms version and terms text, without trust details, token hashes or audit metadata.

## Lifecycle and deployment

Links expire after seven days by default; `COMPLIANCE_APPROVAL_TTL_DAYS` can override this. `FRONTEND_URL` supplies the public link base. Resends have a two-minute cooldown and revoke previous pending links. Failed request-email delivery revokes the unsent request and permits retry. Decision-notification failure does not undo a recorded decision.

Changing the compliance contact during unfinished onboarding, or changing the school type, revokes the applicable old approval. Profile edits, requests, decisions and compliance-gated status changes use the same school-row transaction lock. New single schools cannot submit or activate through a direct API call without matching approval. Approval contact details cannot change while such a school is awaiting admin review.

Deploy backend migration `20261029000000_single_school_compliance_approval`, regenerate the Prisma client, then deploy the backend and web changes together. The migration does not send email or fabricate approval records. Existing mail configuration is reused. On 2026-10-29, this migration was applied to the local development database (`supplyed-local-db` at `localhost:5440`) to resolve Prisma P2022 when loading institution profiles. The affected account's profile query and a compliance-table query then succeeded. Other deployment databases still require the migration.

## Validation

Frontend regression checks: `node --test tests/auth-onboarding.test.cjs`.

Backend focused checks: `npm test -- --runInBand --runTestsByPath src/modules/compliance-approvals/compliance-approvals.spec.ts`.

Coverage includes school-type fields and payloads, independent approval contacts, token handling, failed delivery, resends, expiry, repeated decisions, contact/type changes, direct API submission gates, and preservation of existing submitted/active school routing. Local migration verification also confirmed that existing submitted/active/suspended single schools remain exempt. Live email delivery and migration in other environments require deployment-environment verification.
