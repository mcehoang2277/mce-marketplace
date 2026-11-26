# Feature Status

**As of:** 2026-11-26
**Legend:** Implemented in source ≠ production verified.

| Feature | Source status | Production status | Notes |
|---|---|---|---|
| Register/login | Implemented | Not verified | bcrypt + JWT + PostgreSQL; rate limiting and full auth abuse tests needed |
| Profile / skills | Implemented | Not verified | No real phone/KYC provider |
| Poster job creation | Implemented | Not verified | Creates DRAFT; server calculates budget |
| Public job discovery | Implemented | Not verified | OPEN jobs from PostgreSQL; pagination/filtering improvements pending |
| Worker application | Implemented | Not verified | Unique job/worker constraint exists |
| Applicant review/acceptance | Implemented | Not verified | Concurrency and assignment race tests pending |
| VietQR payment instruction | Implemented | Not live | QR is instruction, not proof of payment |
| SePay HMAC webhook | Implemented | Not live | Sandbox/live provider delivery and reconciliation pending |
| Escrow lock/release/refund | Partially implemented | Not approved for real funds | PostgreSQL transaction logic exists; accounting controls and dispute operations incomplete |
| Wallet balance/history | Implemented read-only API | Not verified | No public withdrawal endpoint; ledger is not double-entry |
| Check-in/check-out | Implemented | Not verified | Device-reported GPS can be spoofed |
| Reviews | Implemented | Not verified | Two-sided unique review constraint exists |
| Admin overview/users/jobs/payments | Partially implemented | Not verified | Privileged mutations need audit/state-machine controls |
| Dispute handling | Incomplete | Disabled for financial settlement | Decision recording is not money settlement |
| KYC / SMS OTP | Not implemented with provider | Unavailable | Do not claim verified KYC/phone verification |
| Bank withdrawals | Not exposed as a production API | Disabled | Internal wallet credit is not a bank payout |
| Photo evidence / anti-spoofing | Not implemented | Unavailable | Future scope after consent/storage/security design |
| Notifications/chat | Not verified as production feature | Unavailable | No reliable outbox/notification pipeline confirmed |
| Vercel production site | Static-only configuration with legacy demo pages | Not ready for production | vercel.json catch-all sends /api paths to mobile.html; auth.html/mobile.html contain client-side OTP/account/wallet/payout simulation |
| Python backend | Legacy/demo | Must remain disabled | SQLite and mock records |
| PowerShell backend | Legacy/local | Must remain disabled | JSON store and fixture records |

## Definition of done

A feature is production-ready only after: API contract, authorization, validation, failure/empty/loading UX, database invariants, automated tests, browser/device verification, logging/monitoring and rollback behavior have evidence.
