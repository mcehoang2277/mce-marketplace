# MCE Marketplace — Implementation Status

**Working branch:** `feat/marketplace-end-to-end`  
**Base:** `fix/mainline-security-workflow`  
**Production:** Not deployed. `main` is not modified.

## Target architecture

- API: TypeScript + Express
- Persistence: PostgreSQL through Prisma
- Native client: Expo / React Native
- Session storage: Expo SecureStore
- Payment QR: VietQR transfer QR
- Bank reconciliation: SePay webhook with HMAC-SHA256

## Implemented in this branch

### Job posting and escrow funding
- Poster creates a DRAFT job; the server calculates the total amount from start/end time and hourly rate.
- Authenticated poster can create a VietQR payment request for the exact server-calculated amount.
- Payment references use random identifiers and pending requests can be reused for a short retry window.
- The job remains DRAFT and is not discoverable until SePay confirms the matching incoming bank transfer.
- SePay webhook validates exact raw request bytes with HMAC-SHA256, signed timestamp (±5 minutes), receiving account, incoming direction, unique transaction ID, payment reference, exact amount, job owner and DRAFT status.
- On a valid payment, a single serializable PostgreSQL transaction writes the payment success, wallet ledger entries, escrow lock, and job OPEN transition.
- Replayed webhook transaction IDs are idempotently acknowledged; unmatched or mismatched transfers are logged as unprocessed for manual reconciliation.

### Applications and work lifecycle
- Worker applications are accepted only for OPEN jobs.
- Poster can view applicants and accept one applicant only when escrow is LOCKED.
- Authenticated worker can check in and check out using Expo Location device coordinates.
- Server validates coordinate ranges, reported GPS accuracy, assigned worker, job state, geofence distance and check-in/check-out order.
- Check-out moves the job to PENDING_REVIEW.
- Only the poster can approve completion; escrow release is performed in a serializable transaction and writes both sides of the wallet ledger.
- Poster and worker can each submit one review per completed job. Karma score is recalculated from received reviews.

### Wallet and profile
- Authenticated read-only wallet balance and ledger history endpoints.
- Native wallet screen reads available/locked balances and transactions from PostgreSQL.
- Profile can update display name and skills.
- Native profile displays phone verification and KYC status without allowing the user to self-assert verification.

### Native app
- Post-job screen creates a job draft and displays the generated VietQR instructions.
- Payment status can be refreshed from the API.
- Active-shift screen uses real device location permissions and calls authenticated check-in/check-out endpoints.
- Profile screen supports edits and post-job review submission.
- Native app does not simulate successful payments, check-ins or payouts.

## Not yet production-ready / intentionally unavailable

1. **SePay live activation:** code supports SePay HMAC, but a SePay account, linked receiving bank account, live HMAC secret, public HTTPS webhook URL and dashboard webhook configuration are still required. The secret must never be committed.
2. **Photo evidence and anti-spoofing:** check-in/out currently use device-reported GPS accuracy and server geofence checks. Mock-location detection, device attestation, photo evidence upload and evidence retention are not implemented. GPS coordinates alone are not proof against spoofing.
3. **Withdrawals:** wallet withdrawals and actual bank payouts remain disabled. Internal wallet credits are not a bank transfer.
4. **Refund operations:** refund service has strict ownership and ledger guards, but no user-facing refund/dispute resolution workflow is exposed.
5. **KYC/SMS OTP:** no eKYC or SMS provider has been selected/configured. Verification flags cannot be self-edited.
6. **Bank-account management:** user bank details are not editable or verified in the app.
7. **Disputes:** dispute workflow, admin review, split settlement and appeal process are not implemented.
8. **Escrow router:** generic escrow routes remain disabled; funding and completion are exposed only through the guarded payment webhook and job approval flow.

## Required environment

Configure only in protected deployment settings:
- `DATABASE_URL`
- `JWT_SECRET` (at least 32 random characters)
- `VIETQR_BANK_CODE`
- `VIETQR_ACCOUNT_NO`
- `VIETQR_ACCOUNT_NAME`
- `SEPAY_WEBHOOK_SECRET` (HMAC-SHA256 secret; at least 32 characters)
- `EXPO_PUBLIC_API_URL` (include the `/api` path)

Never commit real credentials. Configure the SePay webhook for incoming transfers only, HMAC-SHA256, JSON body, and the exact public HTTPS endpoint. SePay documents signing as HMAC-SHA256 over `timestamp.raw_body` and provides `X-SePay-Signature` / `X-SePay-Timestamp` headers.

## Validation

GitHub Actions runs backend Prisma generation, TypeScript build and unit tests, plus Expo/React Native TypeScript checks. A green CI run is static/build validation only. It does not prove:
- PostgreSQL migrations against an empty production-like database;
- SePay live or sandbox webhook delivery and bank reconciliation;
- concurrency, webhook replay and malicious payload behavior under integration tests;
- Android/iOS native builds, location permission UX or real-device behavior.

No production deployment has been performed.

## Required next steps

1. Configure SePay test mode and verify valid signature, invalid signature, stale timestamp, duplicate event, wrong receiving account, wrong amount and unmatched reference.
2. Add PostgreSQL integration tests for job funding, ledger balance invariants, concurrent webhook replay and escrow release.
3. Verify migration chain and seed strategy against an empty PostgreSQL database.
4. Select an eKYC/SMS provider and implement consent, document handling, retention and verification callbacks.
5. Implement secure evidence upload, dispute handling and admin review.
6. Select and integrate a bank payout provider before enabling withdrawals.
7. Build and test Android and iOS on real devices.
8. Complete independent security review before any production release.
