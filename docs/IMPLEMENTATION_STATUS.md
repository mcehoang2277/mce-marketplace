# MCE Marketplace — Implementation Status

**Working branch:** `feat/typescript-native-foundation`  
**Base:** `main` at `2f5131516b7420ecabbd5156d9bbf048a98f4194`  
**Deployment:** Not deployed. Production services and payment routes remain disabled.

## Target architecture

- API: TypeScript + Express
- Persistence: PostgreSQL through Prisma
- Native client: Expo / React Native
- Session storage: Expo SecureStore
- Python backend: legacy/reference only; not the primary API

## Implemented on this branch

- Replaced the no-op build script with Prisma Client generation and TypeScript compilation.
- Removed embedded fallback database credentials, JWT secrets, and webhook secrets.
- Added allow-listed CORS origins and request body limits.
- Added JWT verification and role middleware.
- Replaced in-memory demo authentication with PostgreSQL-backed user registration/login and bcrypt password hashes.
- Added authenticated current-user profile endpoint.
- Added public discovery of OPEN jobs from PostgreSQL.
- Added Poster-only job draft creation and Worker-only applications.
- Added a database unique constraint to prevent duplicate applications.
- Added a native login/register screen and SecureStore-backed token persistence.
- Connected native job discovery and application actions to the API.
- Added native job draft creation using foreground device location.
- Removed simulated wallet balances, fake withdrawals, fake GPS check-in, fake payouts, and fake KYC claims from native screens.
- Added backend GeoUtils tests and a GitHub Actions workflow for backend build/tests and mobile type-checking.

## Explicitly disabled / not production-ready

- VietQR payment creation and bank webhook processing.
- Escrow lock, release, dispute, and payout endpoints.
- Wallet balances and withdrawals.
- SMS OTP, eKYC, profile editing, bank-account verification.
- Assignment approval and durable job lifecycle/check-in/check-out.
- Production job matching from live worker availability.

These remain disabled because the current escrow service still uses process memory and the payment integration has no durable, atomic PostgreSQL ledger or verified bank-provider signature contract. New jobs are created as DRAFT and are not shown in OPEN job discovery until the funding and approval flow exists.

## Database migration warning

The repository did not contain a complete Prisma migration history. This branch adds the password-hash column and application uniqueness SQL as an incremental migration, but it is **not** a complete initial schema migration for an empty database. Use a reviewed baseline migration before any production migration deployment. Do not run `prisma migrate deploy` against an empty database based only on this branch.

The root lockfile was stale relative to package.json, so local/CI installation currently uses `npm install` rather than `npm ci`. Regenerate and commit a reviewed lockfile before release.

## Required environment

Copy `.env.example` to a private `.env` and configure:
- `DATABASE_URL`
- `JWT_SECRET` (at least 32 characters of cryptographically random material)
- `EXPO_PUBLIC_API_URL` in the Expo environment, including the `/api` path

Never commit real credentials.

## Validation status

A GitHub Actions workflow was added. A previous run detected and helped fix two TypeScript errors in the legacy escrow adapter. The latest branch commit still needs a completed green CI run before build/test can be marked PASS.

## Release gates

1. Complete and review a baseline Prisma migration and seed strategy.
2. Move escrow, wallet, and payment idempotency to transactional PostgreSQL records.
3. Integrate and verify the chosen bank/payment provider's webhook signature contract.
4. Implement employer review, assignment, disputes, and job state transitions.
5. Add integration tests for auth, job lifecycle, concurrency, and money invariants.
6. Verify Android and iOS builds on real devices, including location permissions and secure storage.
7. Conduct security review and only then consider a release.
