# Bug Tracker

| ID | Priority | Status | Summary | Owner action / acceptance |
|---|---|---|---|---|
| SEC-001 | P0 | Mitigated in engineering branch; rotation pending | Hardcoded DB/Redis credentials in Compose | No fixed secrets in Compose; rotate if used; Compose config check passes |
| SEC-002 | P0 conditional | Open / owner confirmation needed | PowerShell demo server includes personal-looking fixture records and wildcard CORS | Confirm synthetic data; isolate local demo; no production exposure |
| PAY-001 | P0 for real-money scale | Open | WalletTransaction is not a balanced double-entry journal | Journal entries balance, immutable history and reconciliation tests pass |
| DB-001 | P1 | Open | Fresh-database migration chain needs executed evidence | Empty PostgreSQL migration deploy and schema consistency test pass |
| OPS-001 | P1 | Open | Admin can directly change job status | Only audited, invariant-preserving admin commands may mutate lifecycle |
| OPS-002 | P1 | Open | Dispute decision is separate from financial settlement | UI/API clearly distinguish decision from actual refund/payout |
| AUTH-001 | P1 | Mitigated in engineering branch; CI pending | Protected role operations used JWT role claims until expiry | Current DB role checked before role-sensitive actions |
| AUTH-002 | P1 | Mitigated in engineering branch; tests pending | Admin seed could promote an existing customer by phone | Explicit confirmation; existing non-admin phone is rejected |
| CFG-001 | P1 | Fixed in engineering branch; CI pending | Malformed webhook line in .env.example | Environment template parses and Compose interpolation succeeds |
| PAY-002 | P1 | Open | Concurrent payment intent requests may create multiple pending references | Idempotency/unique intent strategy and concurrency test |
| TEST-001 | P1 | Open | Negative webhook, concurrency, assignment and settlement tests incomplete | Release suite covers failure/race/state invariants |
| BUILD-001 | P1 | Mitigated in engineering branch; CI pending | Docker image omitted HTML/admin runtime assets | Docker build and container route smoke tests pass |
| OPS-003 | P1 | Mitigated in engineering branch; CI pending | Container health check only checked process liveness | Readiness endpoint checks PostgreSQL |
| BUILD-002 | P1 | Open | Root package-lock metadata/dependencies are stale versus package.json | Regenerate lockfile; npm ci succeeds cleanly |
| INFRA-001 | P2 | Mitigated | Redis provisioned without current API consumer | Redis optional profile, not started by default |
| DEPLOY-001 | P0 | Open | Vercel config builds static HTML only and rewrites all paths, including /api/*, to mobile.html; no Express API function/host is configured | Deploy the TypeScript API separately and route /api/* to that HTTPS host; smoke-test login, jobs, payments and admin from the actual Vercel domain |
| SEC-003 | P0 | Open | Public legacy auth/mobile HTML generates OTP locally, falls back to localStorage login/register, marks users verified, and displays local wallet/payout success without a confirmed backend transaction | Remove/disable legacy simulation routes or replace them with API-backed flows; no client-side OTP, KYC, balance, completion or payout success claims |
| PERF-001 | P2 | Open | No measured API/web/database performance baseline | Publish reproducible p50/p95/load report |
| UX-001 | P2 | Open | No complete browser/device E2E evidence | Critical journeys pass browser and real-device matrix |
