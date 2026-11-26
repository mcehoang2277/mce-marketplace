# Docker Setup — MCE Marketplace

This Compose topology is for local/staging-style container operation. For public production, place it behind managed HTTPS ingress, use private networking and managed PostgreSQL where possible.

## 1. Prepare secrets

1. Copy .env.docker.example to .env.
2. Generate unique random values for POSTGRES_PASSWORD, REDIS_PASSWORD and JWT_SECRET.
3. Set DATABASE_URL to use the Compose service hostname postgres, not localhost.
4. Add the exact frontend origin to CORS_ORIGINS.
5. Configure SePay values only in a protected environment after provider setup.
6. Never commit .env.

## 2. Validate configuration

```bash
docker compose config --quiet
```

## 3. Start PostgreSQL and apply migrations

```bash
docker compose up -d postgres
docker compose --profile migrate run --rm migrate
```

The migrate profile uses the dedicated Dockerfile migrator target, which includes the Prisma CLI. It is intentionally a one-off command; the API container does not mutate the schema at startup.

Before applying migrations to an existing database, take a backup and test the upgrade on a sanitized copy. Never use this command against production until the release owner approves the exact migration and recovery plan.

## 4. Start the API and reverse proxy

```bash
docker compose up -d --build
docker compose ps
```

Verify:
- GET /api/health is the process liveness endpoint.
- GET /api/health/ready checks PostgreSQL connectivity.
- GET / and GET /admin serve the web/admin assets from the production image.

## 5. Operational notes

- PostgreSQL is bound to 127.0.0.1:5432 for local host access only; do not publish it publicly.
- Redis is optional and is not consumed by the current API. Do not enable the cache profile without a real consumer and unique credentials.
- Compose publishes HTTP port 80 only. Terminate HTTPS at a managed ingress/reverse proxy before exposing the service publicly.
- Use separate secrets and databases for development, staging and production.
- Backups, restore drills, monitoring, firewall policy, domain, HTTPS and provider webhook verification are separate release gates.
