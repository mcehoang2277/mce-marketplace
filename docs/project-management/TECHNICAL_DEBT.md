# Technical Debt Register

| ID | Debt | Impact | Priority | Planned resolution |
|---|---|---|---|---|
| TD-001 | Root package-lock is stale relative to package.json | Non-reproducible installs and supply-chain uncertainty | P1 | Regenerate and commit lockfile; switch CI to npm ci |
| TD-002 | Legacy Python, PowerShell, SQLite and JSON runtimes coexist with production API | Data divergence and accidental deployment | P1 | Mark local-only, isolate routes, plan retirement |
| TD-003 | WalletTransaction is not a double-entry journal | Financial reconciliation and audit risk | P0 before real-money scale | Introduce journal/entry with balanced posting and migration plan |
| TD-004 | Admin job mutation bypasses domain state machine | Unfunded/incorrect status transitions | P1 | Replace with guarded command services and audit log |
| TD-005 | Payment intent creation is not concurrency-safe | Duplicate pending payment references | P1 | Idempotency key + database uniqueness/transaction |
| TD-006 | No transactional outbox | Notifications may be lost or duplicated | P2 | Add outbox when notifications enter scope |
| TD-007 | Matching fallback distance when coordinates absent | Ranking may mislead users | P2 | Explicit unknown-distance score and UX label |
| TD-008 | No browser E2E suite | Regressions in static web/admin journeys | P1 | Add Playwright or equivalent after CI runtime choice |
| TD-009 | No real-device acceptance automation | GPS/permissions/secure storage risks | P1 | Android/iOS device test checklist and release build |
| TD-010 | No structured audit trail for admin actions | Weak accountability | P1 | Add immutable AdminAuditLog and actor/reason metadata |
| TD-011 | No performance baseline | Optimization is speculative | P2 | Capture p50/p95, query plans, bundle and memory metrics |
| TD-012 | No tested backup recovery | Unknown data recovery capability | P0 before production | Backup automation + restore drill |
