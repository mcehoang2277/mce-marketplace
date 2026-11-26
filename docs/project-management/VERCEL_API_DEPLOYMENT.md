# Vercel + API Deployment Decision

**Status:** Blocked pending an API hosting decision and owner approval.

## Current verified configuration

The current vercel.json:
- Builds mobile.html, auth.html, manifest.json and sw.js as static assets.
- Routes /auth and /mobile to those static pages.
- Routes every other unmatched path to mobile.html.
- Does not define an Express serverless function or an external /api rewrite.

Therefore /api/auth/login and other API calls do not reach the TypeScript Express backend. The Vercel deployment can be green while API-backed product flows are unavailable.

## Recommended deployment split

- Vercel: static web client only.
- Separate Node 20 container/service: TypeScript Express API.
- Managed PostgreSQL: private connection from API and one-off migrator.
- Optional Redis: only after a real consumer exists.
- SePay webhook: HTTPS route to the API host.

## Required configuration before changing Vercel routes

1. Owner selects an API hosting provider and creates a staging API host.
2. Deploy the TypeScript container with protected DATABASE_URL, JWT_SECRET, CORS_ORIGINS and payment sandbox credentials.
3. Run the reviewed Prisma migration job against an empty staging database.
4. Verify GET /api/health/ready returns READY.
5. Add a Vercel rewrite for /api/* to the confirmed HTTPS API origin, ordered before the static catch-all.
6. Configure CORS to the exact Vercel origin and native app requirements.
7. Test login/register, job creation, payment intent, webhook, worker application, admin and error responses through the public Vercel preview URL.
8. Only then replace the legacy auth/mobile UI with the API-backed marketplace UI.

## Legacy static page safety

auth.html and mobile.html currently contain local simulation behavior:
- client-generated OTP fallback;
- localStorage account fallback and hardcoded verified fields;
- simulated wallet credit and withdrawal success even if the API call fails.

These pages must not be treated as production. Disabling or replacing the public routes changes the current user experience, so it is intentionally not performed in this branch without owner approval. Do not advertise real OTP, KYC, wallet payout or bank withdrawal from these pages.

## Owner decision required

Provide the chosen API host/provider (for example a managed Node container platform or VPS) and confirm whether the current Vercel site should be put into maintenance mode until the API-backed version is ready.
