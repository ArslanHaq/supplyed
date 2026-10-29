# Application audit plan — 2026-10-28

Scope: application code in `supplyed-web`, sibling `supplyed-backend`, and sibling `supplyed-admin`. The mobile client is inventoried as an adjacent consumer, not part of the website review. No deployment/infrastructure review, production requests, installations, migrations, seeds, fixes, or destructive tests.

1. Inventory pages, API routes, server actions, backend controllers, roles, DTOs, integrations, schema and migrations; identify tests and preserve existing changes.
2. Trace authentication, token refresh, OAuth, OTP, recovery, 2FA and authorization across frontend/BFF/backend.
3. Review onboarding, documents, profile management, marketplace jobs, applications, invitations, bookings, reviews, conversations, notifications, billing and admin workflows.
4. Review database integrity/concurrency, validation, query bounds, payment/webhook idempotency, upload/preview handling and application security controls.
5. Inspect UI state, contracts, loading/errors, accessibility, rendering and performance; inspect test coverage.
6. Run available non-mutating lint/type/unit checks, isolated build verification, dependency advisories and redacted secret scanning. Inspect integration tests before running; use only explicitly isolated local test resources or mocks.
7. Reproduce findings safely where feasible; distinguish verified behavior from code inspection and unverified risks. Record unexecuted end-to-end scenarios honestly.
8. Produce `AUDIT_REPORT.md`, `TEST_MATRIX.md`, and supporting route/test evidence. Scores are judgment-based and limited by test coverage.

Existing changes: extensive tracked and untracked web work was present before the audit. Application source will not be edited. Backend and admin are read-only source inputs; any compiler output or audit harnesses will be kept inside the web workspace.
