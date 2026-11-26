# MCE Marketplace — Four-Agent Initial Review

**Review date:** 2026-11-26
**Reviewed ref:** feat/marketplace-end-to-end at f5611eca88c6548a16a1f4725f88e5df4d9f18b8
**Review mode:** repository and CI metadata review; no local runtime, production database or real device access.
**Important:** This report distinguishes source-code observations from runtime verification. It is not a production certification.

## Agent 1 — Architect

### Decision
Retain a modular monolith: TypeScript + Express + Prisma + PostgreSQL is the production path; Expo is the native client; static web/admin remain clients. Keep PostgreSQL as the sole source of truth. Python, PowerShell, SQLite and JSON remain local-only demo/legacy until explicitly retired.

### Architecture risks
- Multiple runtime paths can create divergent users, jobs, wallets and admin identities.
- Redis is provisioned in Compose but no Redis dependency/consumer is evident in the root package manifest.
- The current wallet transaction history is not a double-entry accounting journal.
- No production deployment topology has been demonstrated end-to-end.

See ARCHITECTURE.md.

## Agent 2 — Engineer: implementation baseline

### Verified in source
- Express API with Zod validation, JWT/bcrypt identity and Prisma persistence.
- Job draft creation, applications, candidate acceptance, attendance, payment request and SePay webhook paths exist.
- Expo screens call the API for jobs, payment status, wallet and profile.
- Admin APIs and a seeded ADMIN role exist.
- SePay webhook rejects missing/invalid signature and checks timestamp, receiving account, incoming direction, unique provider transaction ID, reference and amount.
- CI configuration includes PostgreSQL migration/build/tests and mobile typecheck; a Vercel status on the reviewed PR head is green.

### Not verified
- Full Android/iOS build and device runtime.
- Live/sandbox SePay account, webhook delivery or bank reconciliation.
- Real database restore, production backup, load capacity or uptime.
- Browser E2E across every screen and route.
- Whether sample data is synthetic.

## Agent 3 — Reviewer: findings

| ID | Priority | Finding | Evidence / impact | Required action |
|---|---|---|---|---|
| SEC-001 | P0 | Compose contains fixed PostgreSQL and Redis credentials | docker-compose.yml hardcodes database URL/password and Redis password; rotate if ever used outside disposable local setup | Require environment secrets; bind DB/cache ports privately; rotate deployed credentials |
| SEC-002 | P0 | Demo server contains hardcoded personal-looking records and permissive CORS | server.ps1 seeds names, phones, email, identity numbers, bank/account details, wallet amounts and wildcard CORS | Keep local-only; confirm synthetic status; remove/replace exposed personal data only after owner confirmation |
| DB-001 | P1 | Fresh-database migration chain still needs execution proof | Initial SQL exists at prisma/migrations/0_init/migration.sql and incremental migrations follow it; source inspection does not prove migrate deploy succeeds on an empty PostgreSQL instance | Run migrate deploy and the full integration suite against a disposable empty PostgreSQL instance |
| PAY-001 | P1 | Wallet accounting is not demonstrably double-entry | WalletTransaction is per-wallet history; no balanced journal/entry model or independent reconciliation report | Define accounting model and invariant tests before real funds at scale |
| PAY-002 | P1 | Payment intent creation has a possible concurrency race | Query for recent pending intent then create is not shown as a single serializable/idempotent operation | Add idempotency key/unique active intent strategy and concurrency test |
| OPS-001 | P1 | Admin can set job status directly | PATCH /admin/jobs/:jobId/status changes status without escrow/state-machine invariants | Replace with guarded commands and append-only admin audit |
| OPS-002 | P1 | Dispute decision is not financial settlement | Admin dispute endpoint records outcome and marks job DISPUTED; it explicitly does not move money | Keep outcome distinct from settlement; add separately authorized financial workflow |
| AUTH-001 | P1 | Non-admin role claims are trusted from JWT until expiry | Middleware validates token claims; admin role is reloaded, but other role changes/account disablement are not shown as immediate | Check current account state/role for sensitive routes or use short-lived/revocable sessions |
| AUTH-002 | P1 | Admin seed could promote an existing account by phone | Fixed on this branch: explicit bootstrap confirmation is required and non-admin accounts are rejected rather than promoted | Add automated tests for missing confirmation, existing customer phone and existing admin rotation |
| CFG-001 | P1 | .env.example had malformed combined webhook line | Fixed on this branch: SePay secret is now a separate variable and the unused legacy key was removed from the template | Add an env-template validation check and verify Compose interpolation |
| TEST-001 | P1 | Test suite is incomplete for release risk | Positive webhook/replay integration test and signature tests exist; negative cases, concurrency, assignment and settlement invariants are incomplete | Add negative, race, state-machine and money-invariant integration tests |
| INFRA-001 | P2 | Redis appears provisioned but unused | Compose includes Redis; root package manifest has no Redis client/queue consumer | Remove from minimal topology until justified or implement a measured use case |
| UX-001 | P2 | Runtime and frontend parity not established | Web, native and local demo routes coexist; CI mobile typecheck is not a device/browser test | E2E smoke suite and device acceptance matrix |

### Additional reviewer notes
- requireRole intentionally permits BOTH users for worker/poster operations; confirm this is the intended product policy.
- GPS accuracy and geofence checks do not prevent a rooted/jailbroken or mock-location device from spoofing coordinates.
- A green Vercel status does not establish PostgreSQL connectivity, API health, SePay configuration or native app readiness.
- Do not expose raw identity/bank/payment data in logs or admin screens without an explicit operational need.

## Agent 4 — Optimizer: initial recommendations

1. Do not add microservices or Redis queue complexity yet.
2. Add indexes from measured query plans, especially status/createdAt and user/job foreign-key access patterns.
3. Use bounded pagination everywhere; avoid unbounded dispute/payment/user queries.
4. Add DB connection-pool limits and query latency metrics before scaling replicas.
5. Add request IDs, structured logs and redact PII.
6. Cache only public job discovery after measuring DB load; never cache balances, payment state or authorization decisions.
7. Use a transactional outbox for future notifications so job/payment state and notification intent cannot diverge.

## Release decision

**Not production-ready for real-money public launch.** The codebase has a useful foundation and a promising end-to-end branch, but P0 security/data and migration verification blockers remain. A controlled staging environment with synthetic data is appropriate after secret/config hardening. Real transfers and broad public onboarding remain blocked pending the P0/P1 release gates.

## Verification status

- Repository source review: completed for selected critical modules.
- CI metadata: partial; the reviewed head has successful Vercel status checks. Backend/mobile workflow evidence must be tied to the exact reviewed SHA before release.
- Runtime tests: not run from this environment.
- Production tests: not run.
- Data authenticity: awaiting repository owner confirmation.
