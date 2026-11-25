# MCE Marketplace — Implementation Status

**Working branch:** `fix/mainline-security-workflow`  
**Base:** latest `main` at the time this branch was created  
**Production:** Not deployed. `main` is not modified by this work.

## Target architecture

- API: TypeScript + Express
- Persistence: PostgreSQL through Prisma
- Native client: Expo / React Native
- Session storage: Expo SecureStore

## Changes in this hardening pass

- Guarded login against accounts with a missing password hash.
- Replaced the obsolete geofence helper calls with the shared Haversine distance implementation.
- Restricted applications to OPEN jobs; draft jobs cannot receive applications.
- Wired authenticated worker application, poster applicant-list, and poster accept/assign endpoints to the application service.
- Required a LOCKED escrow before an application can be accepted and the worker assigned.
- Prevented escrow locking from silently creating or crediting wallet funds. The poster must have an already credited wallet balance.
- Disabled bank webhook processing until a provider-specific signature and transaction-reconciliation adapter is configured. No webhook payload can credit funds or lock escrow in this state.
- Replaced simulated GPS check-in, fake photo evidence, and fake payout success in the native active-shift screen with an explicit not-yet-available state.
- Added this branch to the CI push triggers.

## Features intentionally unavailable

- VietQR payment creation and bank webhook crediting.
- Escrow funding/release/refund routes and real wallet withdrawals.
- Native GPS check-in/check-out, evidence upload and payout.
- SMS OTP, eKYC, profile editing and bank-account verification.
- Dispute management and a complete job lifecycle.

These features must remain unavailable until real provider integrations, durable ledger invariants, authenticated APIs, and end-to-end tests exist. A QR image or client-side success state is not proof of payment.

## Known architecture and release gaps

1. The current payment creation route returns HTTP 503. This is intentional until the bank account and provider contract are configured and tested.
2. Escrow routes remain disabled. Internal escrow service methods are not a substitute for a reviewed accounting ledger or payment reconciliation.
3. Job creation currently creates DRAFT records. There is no public publish/funding workflow; therefore draft jobs are not discoverable.
4. The database migration history needs a reviewed baseline for a clean database before production migration.
5. The root dependency lockfile should be regenerated and reviewed before using `npm ci`.
6. Backend CI currently runs Prisma generation, TypeScript compilation and the repository's test suite. A passing build is not evidence of live database, payment, mobile-device or end-to-end correctness.

## Required environment

Configure secrets only in the deployment environment:
- `DATABASE_URL`
- `JWT_SECRET` (at least 32 characters of cryptographically random material)
- `WEBHOOK_HMAC_SECRET` only when a provider-specific webhook verifier is implemented
- `VIETQR_ACCOUNT_NO` and `VIETQR_ACCOUNT_NAME` only when payment creation is implemented
- `EXPO_PUBLIC_API_URL` in the Expo environment, including the `/api` path

Never commit real credentials.

## Validation

CI is running on the latest branch commits. See the [GitHub Actions runs](https://github.com/mcehoang2277/mce-marketplace/actions). Backend and mobile CI results must both pass on the final branch head before this work is considered validated. No production deployment has been performed.

## Release gates

1. Add a complete baseline Prisma migration and seed strategy; verify it against an empty PostgreSQL database.
2. Implement payment-provider-specific webhook verification using the exact raw request bytes, receiver account, amount, currency and unique bank transaction ID.
3. Add an immutable, auditable ledger with idempotent top-up, escrow lock, release, refund and withdrawal operations.
4. Implement server-side GPS/geofence validation, check-in/check-out state transitions, evidence upload and dispute handling.
5. Add integration tests for authentication, role boundaries, application concurrency, escrow balance invariants and webhook replay/tampering.
6. Verify Android and iOS builds and runtime permissions on real devices.
7. Complete security review before any production release.
