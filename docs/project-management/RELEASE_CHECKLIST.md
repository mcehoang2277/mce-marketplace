# Release Checklist

Only mark an item complete when evidence is linked to the exact release candidate SHA.

## Product and UX
- [ ] Poster can register, create, fund, and publish a job.
- [ ] Worker can register, discover, apply and be assigned.
- [ ] Worker can check in/out and Poster can approve completion.
- [ ] Both parties can see correct status and review.
- [ ] Loading, empty, error, offline and retry states are verified.
- [ ] Web responsive and Android/iOS device acceptance complete.
- [ ] User help, terms, privacy notice and support process approved.

## Security and data
- [ ] All deployed/previously used committed credentials rotated.
- [ ] Demo fixture data confirmed synthetic or removed through approved process.
- [ ] No secrets or private runtime databases are tracked.
- [ ] Authentication, authorization, rate limiting and admin audit reviewed.
- [ ] Webhook negative/replay/concurrency tests pass.
- [ ] Financial ledger is balanced, immutable and reconciled.
- [ ] Data retention, consent and incident response approved.

## Database and operations
- [ ] Fresh PostgreSQL migration deploy passes.
- [ ] Existing database upgrade tested on a sanitized copy.
- [ ] Automated backup and point-in-time recovery configured.
- [ ] Restore drill completed and RPO/RTO accepted.
- [ ] Health/readiness, structured logging, metrics and alerts verified.
- [ ] Database/Redis ports are private.
- [ ] Rollback procedure tested.

## Build and deployment
- [ ] Root lockfile regenerated and clean npm ci succeeds.
- [ ] Backend build, tests, mobile typecheck and Docker build pass on exact SHA.
- [ ] Staging smoke tests pass.
- [ ] A real TypeScript API host is configured; Vercel /api/* routes to it rather than static mobile.html.
- [ ] HTTPS/domain/CORS and payment webhook URL verified.
- [ ] Production environment secrets set in hosting secret manager.
- [ ] No production deploy or real bank transfer without explicit approval.

## Release decision
- [ ] No open P0 findings.
- [ ] All P1 findings closed or formally accepted with mitigation.
- [ ] Security reviewer approval recorded.
- [ ] Product owner approves cohort, geography, categories and support capacity.
- [ ] Release manager approves rollout and rollback owner.

**Current status:** NOT READY for public real-money production.
