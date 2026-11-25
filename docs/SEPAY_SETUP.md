# SePay setup for MCE Marketplace

This integration uses SePay's HMAC-SHA256 bank-transfer webhook. A VietQR image alone is not payment confirmation.

## Server environment

Set these values in the protected API environment (never in Git):
- `VIETQR_BANK_CODE`: bank code used by the VietQR image.
- `VIETQR_ACCOUNT_NO`: exact receiving account number linked to SePay.
- `VIETQR_ACCOUNT_NAME`: receiving account holder name.
- `SEPAY_WEBHOOK_SECRET`: the HMAC secret created in the SePay webhook settings (minimum 32 characters in this app).
- `DATABASE_URL`, `JWT_SECRET`: required API settings.

The account number in SePay webhook payloads must match `VIETQR_ACCOUNT_NO`.

## SePay dashboard

1. Link the receiving bank account that is configured in `VIETQR_ACCOUNT_NO`.
2. Create a webhook for incoming transfers only (`In_only`).
3. Set the destination URL to `https://YOUR_API_HOST/api/webhook/payment`.
4. Choose `HMAC-SHA256` authentication and JSON request content type.
5. Copy the secret once and store it as `SEPAY_WEBHOOK_SECRET` in the API hosting environment.
6. Enable webhook retry for non-2xx responses.
7. Send a test event and confirm that the API returns HTTP 200 with `{"success":true}`.

Do not use the unauthenticated webhook mode in production. Keep the webhook endpoint on HTTPS.

## What the API verifies

- HMAC-SHA256 over `timestamp.raw_body` using the exact raw request bytes.
- `X-SePay-Timestamp` is within five minutes.
- Signature comparison is constant-time.
- Receiving bank account matches the configured account.
- Transfer direction is incoming.
- Unique SePay transaction ID has not been processed before.
- Transfer content contains the generated MCE payment reference.
- Amount exactly matches the pending payment and server-calculated job budget.
- Payment belongs to the poster who created the DRAFT job.

Only after all checks pass does one PostgreSQL transaction mark the payment successful, write top-up and escrow ledger entries, lock the escrow and change the job from DRAFT to OPEN.

## Before enabling live transfers

Run SePay Test mode and verify:
- valid signed payment opens a job once;
- duplicate/replayed transaction ID does not add a second ledger credit;
- invalid HMAC and stale timestamp are rejected;
- wrong receiving account is rejected;
- wrong amount and unknown references are recorded but do not open a job;
- outgoing transfers never credit a wallet.

Any mismatch is left for manual reconciliation. Do not manually change payment status in the database to bypass reconciliation.
