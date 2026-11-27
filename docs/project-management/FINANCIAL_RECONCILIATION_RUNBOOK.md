# Financial reconciliation operations runbook

**Status:** Phase 4 implementation specification; no production execution is authorized.
**Parent work:** feat/ledger-webhook-concurrency (PR #3).
**Launch policy:** platform fee remains 0%; no live payout or production money movement is enabled by this document.

## Objectives

1. Reconcile every existing wallet's available and locked balances to the new double-entry journal before financial cutover.
2. Give verified incoming transfers in SUSPENSE a controlled, auditable resolution path.
3. Preserve append-only financial history and prevent an operator from creating spendable funds by editing a wallet directly.

## Non-negotiable safety rules

- Never run an opening-balance import against production until a read-only rehearsal, backup, restore test, signed reconciliation report, and explicit Founder approval are complete.
- Never infer opening balances from totalDeposited or totalWithdrawn; the source of truth for the opening snapshot is the wallet's current availableBalance and lockedBalance, reconciled against escrow and pending payout records.
- Do not overwrite historical wallet transactions, ledger postings, webhook payloads, or bank evidence.
- Every adjustment is a new balanced journal posting with a unique idempotency key and a durable operator/audit record.
- No automatic credit to a user from a SUSPENSE item based only on a transfer memo/reference. Verify bank transaction identity, exact amount, destination account, recipient ownership and supporting evidence.
- Refunds must be executed only after a verified bank payout/transfer process exists. A ledger reclassification is not proof that money has been returned to the sender.
- Separate preparation from approval. The person preparing a reconciliation must not approve their own monetary adjustment.
- Never include raw bank account numbers, identity numbers, webhook secrets, or full webhook payloads in admin list responses or ordinary application logs.

## Workstream A — opening-balance reconciliation

### A1. Read-only inventory

Produce a timestamped snapshot containing:
- Wallet ID and user ID (restricted report; user-facing exports must redact identifiers).
- availableBalance and lockedBalance at the same database snapshot.
- Wallet transaction totals grouped by type and reference.
- Escrow rows grouped by PENDING, LOCKED, RELEASED, REFUNDED, and PARTIALLY_REFUNDED.
- Pending withdrawal reservations and their PAYOUT_PENDING:{userId} journal balances.
- Ledger account balances by account code and debit/credit side.
- Duplicate or orphan references, negative balances, and any wallet/escrow mismatch.

Use a repeatable-read or serializable read-only snapshot. Record the database snapshot time and query/report version. The report must not mutate any table.

### A2. Reconciliation equations

For each user:
- Expected available wallet liability must equal the wallet's availableBalance.
- Expected locked wallet liability must reconcile to locked escrow obligations and any explicitly modeled locked sub-balances; do not assume all locked wallet funds are represented by one escrow without checking.
- PAYOUT_PENDING:{userId} must equal withdrawals reserved but not yet confirmed settled or reversed.
- The SUSPENSE liability must equal verified unmatched incoming bank funds not yet assigned or refunded.
- Every existing ledger posting must balance debit and credit exactly in VND to two decimal places.

Differences are exceptions, not rounding adjustments. Quarantine the affected account/job from new financial actions until resolved.

### A3. Opening snapshot and approval

After all exceptions are resolved:
1. Generate a deterministic opening-balance batch ID and immutable CSV/JSON evidence file.
2. Include per-account opening debit/credit lines and a control total.
3. Require preparer and independent approver identities, approval timestamps, evidence hash, and explicit effective timestamp.
4. Apply the opening journal exactly once using a unique idempotency key per batch/account.
5. Re-run the same reconciliation report and require zero unexplained difference.
6. Keep the original report, approved evidence hash, and posting IDs for audit.

Do not import a zero balance for accounts that are absent from the report unless the account's absence is explicitly verified. Do not use a single balancing plug account to hide unexplained differences.

## Workstream B — SUSPENSE operations

### B1. Read-only queue

Admin queue requirements:
- Paginated, bounded results; filters by age, amount band, provider, and resolution state.
- Display bank event ID, event timestamp, amount, masked destination account, reason, payment reference if safely parsed, and linked journal posting.
- Never expose the full raw webhook body or HMAC secret in the list response.
- Show the evidence checklist and a clear distinction between UNMATCHED, UNDER_REVIEW, APPROVED_TO_CREDIT, APPROVED_TO_REFUND, RESOLVED, and REJECTED.
- Keep unresolved items visible; do not silently expire or delete them.

### B2. Resolution paths

**Credit to a user wallet** is permitted only when the operator verifies the originating bank transaction, exact amount, intended recipient, and ownership/evidence. The approval transaction must atomically:
- Lock the SUSPENSE item and target wallet in deterministic order.
- Re-check that the item is unresolved and the approved amount exactly matches the suspense journal balance.
- Create a balanced reclassification posting: DEBIT SUSPENSE, CREDIT USER_AVAILABLE:{userId}.
- Increment the wallet's available balance and write the corresponding wallet transaction.
- Record the approving admin, preparer, reason, evidence references/hash, amount, target user, posting ID, and timestamps.
- Use an idempotency key derived from the immutable suspense item and approved resolution version.

**Refund to sender** must remain unavailable until an actual bank/PSP payout integration and independently verified settlement callback exist. Once available, the flow must:
- Require maker-checker approval and verified destination details.
- Reserve the suspense liability in a dedicated payout-pending account.
- Submit through the configured provider with an idempotency key.
- Confirm settlement from a verified provider event before marking the item resolved.
- Reverse failed/expired payout reservations through a new balanced journal posting, never by editing the original posting.

**Reject / keep under review** must not move funds. Require a reason and preserve the item for later review.

### B3. Admin authorization and audit

- All routes require fresh server-side ADMIN authorization, not only a client-side role check.
- Read-only queue access and monetary approval should be separate permissions where practical.
- Require re-authentication or step-up confirmation for credit/refund approvals.
- Enforce maker-checker: preparer cannot approve own action.
- Add immutable audit events for list/detail access to sensitive evidence, preparation, approval, rejection, and settlement.
- Use optimistic state checks plus row locks/serializable transactions. Concurrent duplicate approvals must result in exactly one posting and one wallet mutation.
- Return stable conflict responses for already-resolved items; never return a success that implies a second credit.

## Workstream C — database and test controls

Before enabling this workflow:
- Add a durable reconciliation entity with unique source event, status, amount, evidence metadata, preparer, approver, and resolution posting references.
- Add database constraints for positive amounts, valid state transitions where feasible, and unique idempotency keys.
- Keep LedgerPosting/LedgerLine append-only for application roles; corrections must be compensating postings.
- Add integration tests for duplicate approval, two admins racing, preparer approving own item, amount mismatch, wrong user, stale status, rollback after journal failure, and exact wallet/ledger parity.
- Add tests proving raw payload, bank account number, and secrets are not returned by admin endpoints.
- Run the full PostgreSQL 16 migration/test suite on the PR branch. Do not infer a pass from TypeScript compilation alone.

## Delivery sequence and acceptance gates

| Order | Deliverable | Acceptance gate |
|---|---|---|
| 1 | Read-only reconciliation queries/report | Reproducible snapshot; zero writes; all differences classified |
| 2 | Reconciliation schema and audit model | Migration additive; unique source/idempotency constraints; migration tests |
| 3 | SUSPENSE admin read-only queue | ADMIN-only, paginated, redacted, no money mutation |
| 4 | Maker-checker resolution service | Atomic ledger + wallet + audit; race and replay tests |
| 5 | Opening-balance import rehearsal | Deterministic, signed, idempotent, independent approval |
| 6 | Staging rehearsal and restore drill | Exact parity after restore and replay; no production money |

## Explicitly out of scope until separately approved

- Production migrations or backfills.
- Live crediting, refunding, payout or bank transfer.
- Provider activation, production secrets, paid infrastructure, or deployment.
- Deleting or rewriting any historical financial record.
- Changing the 0% platform-fee policy.
- Treating a SUSPENSE posting as user spendable balance before an approved reclassification.
