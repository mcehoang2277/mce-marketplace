# MCE Marketplace — 90-Day Product & Engineering Roadmap

**Planning window:** 2026-11-26 to 2027-02-25
**Status:** Proposed plan; dates and targets require founder confirmation.
**Product strategy:** Launch a controlled local pilot around one complete, trustworthy Poster → Worker → funded job → completed shift → reviewed payment lifecycle. Avoid broad feature expansion before reliability.

## North-star outcome

A new Poster can create and fund a legitimate job; a Worker can discover and apply; the Poster can assign one Worker; the Worker can check in/out; the Poster can approve; and both parties can see a consistent, auditable outcome. Operations can reconcile exceptions without editing financial rows manually.

## Month 1 — Stabilize the foundation (Weeks 1–4)

### Week 1: Ownership, secrets and runtime boundaries
- Freeze the current baseline and preserve PR #1 for separate review.
- Designate TypeScript + PostgreSQL as the only production backend.
- Mark Python/PowerShell/JSON/SQLite paths as local demo/legacy; prevent public production routing.
- Remove hardcoded Compose credentials; require secrets from protected environment.
- Correct .env.example, document required variables and rotate any credential that was actually used.
- Inventory all sample data and confirm whether it is synthetic before publishing or deleting anything.

**Exit gate:** a clean environment can start the API without committed secrets; demo services cannot be mistaken for production.

### Week 2: Database and financial correctness
- Reconcile the actual Prisma migration chain against an empty PostgreSQL database and a copy of the current schema.
- Produce a reviewed baseline migration strategy; do not run destructive migration against user data.
- Define the accounting model and ledger invariants; introduce journal/entry model only after a reviewed migration and backfill plan.
- Add unique constraints and idempotency for payment events, payment intents, assignment and settlement.
- Add reconciliation report for unmatched, duplicate, stale and amount-mismatched bank events.

**Exit gate:** empty-database migration test passes; ledger invariants and reconciliation tests pass; restore plan documented.

### Week 3: API security and lifecycle correctness
- Enforce database-backed active-user/role checks for sensitive operations.
- Add login/register/webhook/admin rate limits, secure headers and request correlation IDs.
- Make admin state transitions obey the same job/escrow state machine; audit every privileged action.
- Ensure dispute decisions are separate from financial settlement and cannot falsely imply a refund or payout.
- Add transaction conflict retry policy only where safe and idempotent.

**Exit gate:** authorization matrix, invalid transition tests and admin audit tests pass.

### Week 4: Integration and release engineering
- Add PostgreSQL-backed integration tests for register/login, job creation, funding, duplicate webhook, wrong amount, assignment, check-in/out, approval and settlement.
- Ensure integration tests fail loudly instead of silently skipping in the release pipeline.
- Add lockfile reproducibility, dependency audit, production build and staging deploy workflow.
- Create staging environment and smoke tests; no production payment credentials.

**Exit gate:** clean CI on the release branch; staging health checks and smoke tests pass.

## Month 2 — Complete the pilot product (Weeks 5–8)

### Week 5: Poster journey
- Simplify onboarding and role selection.
- Improve job form validation, budget preview, draft recovery and clear funding instructions.
- Add explicit payment-pending, paid, expired and reconciliation-required states.
- Prevent accidental duplicate job/payment creation.

### Week 6: Worker journey
- Improve job discovery filters and job detail trust information.
- Complete application, withdrawal and assignment status UX.
- Explain location permission, check-in time window and GPS accuracy requirements.
- Ensure the worker can recover from network interruption without duplicate actions.

### Week 7: Work completion and operations
- Complete check-in/out history, poster approval and mutual review.
- Add support/dispute intake and evidence metadata; keep settlement manual until audited.
- Admin console: read-only operations first, then audited actions with confirmation and reason.
- Add user-facing status notifications (in-app first; paid SMS only after provider approval).

### Week 8: Product quality and conversion
- Run moderated usability tests with a small group of real Posters and Workers.
- Fix top onboarding drop-offs, confusing payment steps and incomplete/empty states.
- Accessibility, mobile responsiveness, Vietnamese copy and low-bandwidth behavior.
- Define event analytics with privacy-safe events and consent.

**Exit gate:** invited testers can complete the end-to-end workflow in staging without operator database edits; critical UX defects are closed.

## Month 3 — Harden and launch controlled pilot (Weeks 9–12)

### Week 9: Performance and reliability
- Establish baseline p50/p95 API latency, error rate, database connection usage and page load.
- Add indexes only from query plans and measured slow queries.
- Load-test job discovery, applications and webhook bursts using synthetic data.
- Test concurrent duplicate webhook and concurrent assignment/approval.

### Week 10: Security and operations
- Independent security review of authentication, admin, payment webhook, PII, file uploads and dependencies.
- Verify encrypted backups and perform a restore drill.
- Add uptime/error monitoring, structured logs, alert thresholds and incident ownership.
- Document payment reconciliation, dispute triage, data incident and rollback runbooks.

### Week 11: Closed pilot
- Enable only the approved provider sandbox/live configuration after business/legal approval.
- Invite a small cohort in one defined geography and limited job categories.
- Daily review of failed payments, unmatched transfers, cancellations, disputes, support requests and completion rates.
- Keep withdrawals and automated dispute settlement disabled until provider and accounting controls are approved.

### Week 12: Release decision
- Review pilot metrics and all open P0/P1 findings.
- Confirm support capacity, backup recovery, monitoring and rollback.
- Ship only if all release gates pass; otherwise extend the pilot and fix blockers.
- Publish a changelog and user help/FAQ; prepare the next-quarter roadmap from observed behavior.

## Proposed pilot metrics (targets to validate with founder)

| Metric | Initial target | Measurement |
|---|---:|---|
| Successful end-to-end job completion | ≥ 90% of assigned jobs | Completed / assigned jobs, excluding agreed test jobs |
| Payment reconciliation | 100% of successful incoming transfers reconciled | Bank events vs payment records vs ledger |
| Duplicate financial posting | 0 | Duplicate journal/ledger posting incidents |
| Critical security findings | 0 open | Reviewed security backlog |
| API availability during pilot | ≥ 99.5% | Health monitoring, excluding planned maintenance |
| API latency | p95 < 500 ms for normal read/write APIs | Staging and pilot telemetry, excluding provider callbacks |
| Support first response | < 1 business day | Support queue timestamps |
| User satisfaction | ≥ 4/5 average | Post-job feedback; interpret with sample size |

Targets are proposed, not measured results or contractual guarantees.

## Scope guardrails

**In scope:** registration/login, profiles, job creation, job discovery, applications, assignment, QR payment instruction, authenticated bank webhook, escrow lock/release under controlled operations, attendance, reviews, read-only wallet history, admin support and reconciliation.

**Not in the first 90-day critical path:** automated eKYC, SMS OTP if no approved provider, bank withdrawals, multi-bank payout, automated split-dispute settlement, sophisticated AI matching, microservices, multi-region infrastructure.

## Weekly governance

- Monday: prioritize the next sprint using user value, risk and effort.
- Daily: review CI, errors, payment reconciliation and blocked issues.
- Friday: demo only working features, review test evidence and update the risk register.
- Every release: branch → PR → CI → reviewer approval → staging verification → explicit release approval.

## Founder decisions and revised release gates — 2026-11-26

1. Keep platform fee at 0% until a separate explicit Founder decision changes it; snapshot the policy in every escrow.
2. Treat Web/PWA and Expo as equal first-class clients of one shared API.
3. Target managed Node.js + managed PostgreSQL; do not deploy or provision paid infrastructure without a separate approval.
4. Prioritize Ledger, webhook reconciliation, idempotency and concurrency before UI expansion.
5. Do not open live-money beta until opening balances are reconciled, suspense operations exist, payout provider settlement is implemented, legal/accounting review is documented, and backup/restore is rehearsed.
6. Keep the holiday change freeze and pilot timing in the 90-day plan; do not bypass financial release gates to meet a calendar date.
