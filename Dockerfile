# ==============================================================================
# MULTI-STAGE PRODUCTION DOCKERFILE FOR MCE MARKETPLACE
# Tối ưu hóa kích thước image, bảo mật non-root user và tốc độ khởi động
# ==============================================================================

# STAGE 1: BUILD STAGE
FROM node:20-alpine AS builder
WORKDIR /app

# Cài đặt dependencies phục vụ build
COPY package*.json ./
RUN npm ci

# Sao chép mã nguồn và biên dịch TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Gỡ bỏ devDependencies để giảm dung lượng image
RUN npm prune --production

# ==============================================================================
# STAGE 2: PRODUCTION RUNTIME STAGE
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000

# Tạo non-root user để tăng cường bảo mật container
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Sao chép các tệp đã biên dịch và production node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY index.html auth.html MCE-Marketplace.html mobile.html manifest.json sw.js ./
COPY data/ ./data/

# Phân quyền cho non-root user
USER nodejs

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/api/health || exit 1

CMD ["node", "dist/server.js"]
