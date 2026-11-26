# Project Audit — MCE Marketplace

**Snapshot:** 2026-11-26
**Reviewed branch:** feat/marketplace-end-to-end (base of agent/cto-roadmap-2026-11)
**Current engineering branch:** agent/cto-roadmap-2026-11

## Executive assessment

MCE has moved beyond a static mockup: the repository contains a TypeScript/Express API, Prisma/PostgreSQL schema and migrations, a React Native/Expo client, static web/admin clients, payment/escrow workflows, and CI. The end-to-end branch is the best current development baseline.

It is **not certified for public real-money production**. Critical unknowns remain around the nature of committed demo records, real provider configuration, ledger/accounting controls, migration execution evidence, full E2E/device testing, operational recovery and independent security review.

## Repository map

| Area | Purpose | Assessment |
|---|---|---|
| src/app.ts, src/server.ts | Express application/runtime | Main API path |
| src/routes | HTTP API routes | Business authorization and state transitions need continued review |
| src/modules | Identity, matching, payment and escrow services | Core domain logic exists |
| src/core | Auth, DB, errors and utilities | Current role check hardened on engineering branch |
| prisma | PostgreSQL schema, seed and migration history | Initial migration and incremental migrations exist; fresh DB execution must be evidenced |
| mobile | Expo / React Native client | API-connected screens; typecheck is not device acceptance |
| index.html, public | Web marketplace and admin assets | Docker runtime asset-copy defect fixed on engineering branch; browser E2E pending |
| api_server.py, server.ps1, data | Python/PowerShell/SQLite/JSON legacy paths | Local/demo only; must not serve production traffic |
| Dockerfile, docker-compose.yml, nginx.conf | Container deployment | Compose secrets and DB readiness hardened on engineering branch |
| .github/workflows | CI | Backend migration/tests and mobile typecheck; Docker validation added on engineering branch |

## Product journey

1. Register/login and profile.
2. Poster creates a DRAFT job.
3. Poster creates VietQR payment instructions.
4. SePay webhook verifies and reconciles incoming transfer.
5. Funded job becomes OPEN.
6. Worker discovers and applies.
7. Poster accepts one applicant.
8. Worker checks in/out using GPS/geofence checks.
9. Poster approves completion; escrow release credits worker wallet.
10. Both sides can review; user can inspect wallet history.

The source contains these pieces, but the full journey has not yet been verified in a live staging environment.

## Top risks

- Fixed Compose credentials (removed on engineering branch; rotate if ever used).
- Demo/local fixtures contain personal-looking values and permissive local CORS (synthetic status not confirmed).
- Legacy demo candidate endpoints returned in-memory candidate details (disabled in production on engineering branch).
- Docker image omitted web/admin assets (fixed on engineering branch).
- Readiness endpoint previously checked only process status; database readiness added on engineering branch.
- Admin job status mutation can bypass escrow/state invariants.
- Wallet history is not a balanced double-entry accounting journal.
- Payment intent creation and some job lifecycle paths need concurrency tests.
- Root npm lockfile is stale relative to package manifest; reproducible install remains open.
- Full browser/device, payment provider and disaster-recovery tests are outstanding.

## Scope and evidence limits

This audit used repository source and GitHub metadata. It did not inspect local uncommitted files, connect to production systems, inspect real user records, run a local Docker stack, test a real device, or initiate bank transfers. A green CI job is evidence only for the steps that actually ran.
