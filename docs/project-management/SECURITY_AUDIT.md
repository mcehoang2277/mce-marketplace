# Security Audit — Initial

**Scope:** source review of the development branch; not a penetration test.
**Date:** 2026-11-26

## Confirmed controls

- Password hashes use bcryptjs with 12 rounds.
- JWT secret has no embedded fallback; middleware rejects missing/short configuration.
- Zod validates several key API inputs.
- Express disables x-powered-by, uses CORS allowlist and a 1 MB JSON/urlencoded body limit.
- SePay signature helper checks HMAC-SHA256, exact raw body, 5-minute timestamp window and timing-safe comparison.
- Webhook checks incoming direction, receiving account, transaction id, reference and exact amount before atomic state changes.
- Admin authorization reloads current database role.
- Engineering branch additionally pins JWT verification to HS256, reloads current role for protected mutations, narrows webhook duplicate acknowledgement, removes fixed Compose credentials, adds local data ignore rules, and prevents unsafe admin seed promotion.

## Open findings

### Deployment blocker
- **P0 — API routing:** vercel.json builds static pages only and rewrites every unmatched path, including /api/*, to mobile.html. The TypeScript Express API has no Vercel function entrypoint or configured external API rewrite. API-backed auth/payment/admin journeys cannot be considered deployed from Vercel status checks. Host the API separately and configure an explicit HTTPS /api proxy before production.


### Critical / release blockers

0. **Public legacy simulation:** vercel.json publishes auth.html and mobile.html. Source inspection shows client-generated OTP fallback, local-only registration/login fallback, hardcoded verified/user identity fields, local wallet credits and local withdrawal success even when the API request fails or is absent. Treat these pages as demos, not production; disable or replace before public traffic. Do not treat localStorage/sessionStorage as authentication, KYC or money state.
1. **Credential exposure history:** Compose credentials were committed. They have been removed from the engineering branch template, but any credential that was ever deployed must be rotated. Removing a string from current source does not erase Git history.
2. **Demo fixture privacy:** PowerShell server code contains personal-looking sample records and permissive wildcard CORS. Owner must confirm the records are synthetic. If not, incident response and data removal must be planned with explicit approval.
3. **Financial ledger controls:** current wallet transaction records are not a balanced double-entry journal. Do not scale real funds or enable withdrawals until this is resolved and independently reconciled.

### High
4. Admin can directly mutate job status without escrow/state-machine guards.
5. Admin dispute endpoint records a decision but does not settle money; ensure product UI never represents a refund/payout as complete.
6. Payment intent creation has a race window that may create multiple pending intents.
7. Login/register abuse controls and API-wide rate limits need independent verification.
8. Root package lockfile is stale; supply-chain reproducibility is not yet acceptable.
9. No upload pipeline is approved for identity/evidence documents; do not accept sensitive files until MIME/content scanning, size limits, malware handling, private storage and retention controls exist.
10. Logging/redaction and security monitoring are not proven.

## Required security tests

- Missing, malformed, stale and invalid webhook signatures.
- Wrong account, outgoing transfer, unknown reference, wrong amount, duplicate event and concurrent replay.
- JWT invalid signature, expired token, wrong algorithm, demoted role and deleted user.
- Worker/Poster/BOTH/Admin authorization matrix.
- Admin seed confirmation and collision tests.
- XSS/CSRF review for cookie-based flows (current API primarily uses bearer tokens).
- SQL injection and mass-assignment tests for every mutation.
- Rate-limit tests for auth and webhook.
- Dependency audit and secret scanning.
- Backup access controls and restore drill.

## Security decision

No real-money public launch until P0 findings are closed, P1 authorization/payment tests pass, credentials are rotated where necessary, and an independent security review is recorded.
