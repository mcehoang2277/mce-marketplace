# Build stage
FROM node:20-bookworm-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/
WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN npm install --no-audit --no-fund
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build
FROM builder AS migrator
ENV NODE_ENV=production
CMD ["npx", "prisma", "migrate", "deploy"]

# Keep the full Prisma CLI in the one-off migration image, but prune it from API runtime.
FROM builder AS production-deps
RUN npm prune --omit=dev

# Runtime stage
FROM node:20-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates wget && rm -rf /var/lib/apt/lists/
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000

RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs --create-home --home-dir /home/nodejs nodejs

COPY --from=production-deps --chown=nodejs:nodejs /app/package*.json ./
COPY --from=production-deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=production-deps --chown=nodejs:nodejs /app/dist ./dist
COPY --from=production-deps --chown=nodejs:nodejs /app/prisma ./prisma
# The Express app serves the web and admin clients from these paths at runtime.
COPY --chown=nodejs:nodejs index.html ./index.html
COPY --chown=nodejs:nodejs public ./public

USER nodejs
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/api/health/ready || exit 1

CMD ["node", "dist/server.js"]
