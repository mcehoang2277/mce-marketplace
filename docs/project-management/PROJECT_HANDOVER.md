# Project Handover — MCE Marketplace

**Snapshot:** 2026-11-26

## Source of truth

- Repository: mcehoang2277/mce-marketplace
- Default branch: main
- Existing product PR: #1, feat/marketplace-end-to-end → main (draft; not merged)
- Engineering branch: agent/cto-roadmap-2026-11 (branched from PR #1 head)
- Main branch was not modified by this work.

## What changed on the engineering branch

- Added architecture blueprint, 90-day roadmap and initial four-agent review.
- Removed hardcoded database and Redis credentials from Docker Compose; database binds to loopback; Redis is optional and private.
- Added .env.docker.example and corrected .env.example.
- Added ignore rules for local runtime database and private env files.
- Hardened admin bootstrap to require explicit confirmation and reject promotion of an existing non-admin account.
- Revalidated current role from PostgreSQL for role-protected operations and restricted JWT verification to HS256.
- Acknowledged webhook duplicates only if the same provider event already exists.
- Disabled legacy in-memory candidate/matching endpoints in production.
- Included index.html and public assets in Docker runtime image.
- Added database readiness endpoint and health integration test.
- Extended CI to run for the engineering branch and validate Compose config and Docker build.

## Known limitations

- No local Docker/runtime execution was possible in this environment.
- GitHub Actions for the latest commits must be checked before considering changes verified.
- No production database or user data was modified.
- No production deployment or real payment was performed.
- Wallet accounting, admin state mutation, payment intent concurrency and end-to-end tests remain open.
- User confirmation is still required on whether committed sample personal-looking records are entirely synthetic.

## Next operator steps

1. Review the current engineering branch diff and latest CI run.
2. Confirm fixture data authenticity and whether any committed Compose credentials were ever used in an internet-accessible environment.
3. Rotate affected credentials outside Git if required.
4. Run local Docker Compose from .env.docker.example copied to .env with unique values.
5. Verify admin and payment provider configuration only in staging.
6. Continue reviewer and optimizer passes before merging the stacked PR.

## Latest verification and deployment findings

- Code SHA a65f2d2e passed the full current backend + Docker smoke pipeline: PostgreSQL migration, 10/10 tests, mobile typecheck, Compose config, migrator target build/run, API image build and container smoke test.
- Dockerfile now uses Debian/OpenSSL, an explicit Prisma migrator target, a pruned production runtime image and the official non-root Node user.
- Compose includes a one-off migrate profile; see DOCKER_SETUP.md.
- Vercel remains a P0 blocker: static-only routing sends /api/* to mobile.html, and legacy auth/mobile pages simulate OTP and wallet/payout success.
- The public repository tracks data/database.json. It was not read or deleted pending owner confirmation that it contains synthetic data only.
