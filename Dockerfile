# Multi-Stage Production Dockerfile for Cricket 2026 Authoritative Game Server
# Base image: Node.js 22 Alpine for minimal footprint and security
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root workspace manifests
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Install full dependencies (including devDependencies needed for TypeScript compilation)
RUN npm ci

# Copy TypeScript source code
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server

# Build shared package and authoritative server
RUN npm run build -w @cricket2026/shared
RUN npm run build -w @cricket2026/server

# Stage 2: Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# Install curl for container health check
RUN apk add --no-cache curl

# Copy root manifests and package manifests
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Install only production dependencies
RUN npm ci --omit=dev

# Copy compiled JavaScript output from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist

# Expose game server WebSocket port
EXPOSE 4000

# Container Healthcheck against /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

# Start authoritative server
CMD ["node", "packages/server/dist/index.js"]
