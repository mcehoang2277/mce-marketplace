# MCE financial ledger — implementation contract

**Decision owner:** Founder
**Effective launch policy:** platform fee 0 basis points (0%) until a separately approved policy change.
**Client topology:** Web/PWA and Expo share the same TypeScript API and PostgreSQL domain model.
**Hosting direction:** managed Node.js application + managed PostgreSQL. No production hosting or payment secrets are changed by this PR.

## Chart of accounts

| Code | Type | Purpose |
|---|---|---|
| BANK_CLEARING | ASSET | Verified money received into the configured settlement account |
| USER_AVAILABLE:{userId} | LIABILITY | User funds available to reserve/spend |
| ESCROW_JOB:{jobId} | LIABILITY | Funds reserved for one job |
| PAYOUT_PENDING:{userId} | LIABILITY | Withdrawal reserved but not yet confirmed paid by a PSP/bank |
| SUSPENSE | LIABILITY | Verified incoming bank money that cannot safely be matched |

All journal amounts are positive VND values. Every posting must balance total DEBIT = total CREDIT before the enclosing PostgreSQL transaction can commit. Journal rows are append-only at the application layer and use unique idempotency keys.

## Posting flows

- Matched bank deposit: DEBIT BANK_CLEARING / CREDIT USER_AVAILABLE.
- Escrow lock: DEBIT USER_AVAILABLE / CREDIT ESCROW_JOB.
- Escrow release: DEBIT ESCROW_JOB / CREDIT worker USER_AVAILABLE.
- Escrow refund: DEBIT ESCROW_JOB / CREDIT poster USER_AVAILABLE.
- Unmatched or mismatched incoming transfer: DEBIT BANK_CLEARING / CREDIT SUSPENSE.
- Withdrawal request: DEBIT USER_AVAILABLE / CREDIT PAYOUT_PENDING. This is only a reservation; it is **not** proof that a bank transfer occurred.

The 0% fee decision is snapshotted into each new escrow (platformFeeRate=0, platformFeeVnd=0, netWorkerPayout=grossAmount). Do not silently change historical escrow rows if a future fee policy is approved.

## Concurrency controls

- Job state-changing financial flows lock the Job row first.
- Wallet rows are locked in sorted user-id order to reduce cross-job deadlocks.
- Wallet debits use conditional UPDATE with balance >= amount and assert exactly one row changed.
- A partial unique PostgreSQL index permits at most one PENDING payment intent per non-null jobId.
- Payment-intent creation also locks the Job row and reuses the existing pending QR intent.
- Provider event IDs and ledger posting idempotency keys are unique.

## Operational and launch limitations

1. The SePay handler still depends on the configured HMAC contract and exact raw-body capture. Configure the real provider only after validating its official signature specification and a sandbox event.
2. SUSPENSE entries are durable and visible in WebhookEvent/LedgerPosting, but a reconciliation dashboard and approval workflow remain future work. Do not treat suspense as user spendable balance.
3. Payout requests are reserved in PAYOUT_PENDING. There is no live PSP payout integration or settlement confirmation endpoint in this change. Do not tell users their withdrawal has been paid.
4. This journal is an application-enforced double-entry ledger. A database-level deferred balancing trigger, formal accounting review, opening-balance migration and reconciliation of historical wallet data remain required before live-money launch.
5. The migration intentionally aborts if more than one PENDING payment exists for a job. Reconcile duplicates manually before deployment; it does not delete or choose a payment automatically.
6. Existing wallet balances are not backfilled into the new journal by this migration. The migration is additive and safe to rehearse on staging, but production financial cutover requires a signed opening-balance reconciliation.

## Deployment

- Run prisma migrate deploy against a staging clone first.
- Verify no duplicate pending payment intents before applying the migration.
- Back up and test restore before any production migration.
- Keep webhook secrets in the managed host secret store, never in Vercel static environment or repository files.
- Roll forward with corrective migrations; do not drop ledger tables or rewrite financial history as a rollback.
