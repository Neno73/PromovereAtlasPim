# syntax=docker/dockerfile:1.6
# Multi-stage build for Next.js 16 production deployment.
# Relies on `output: "standalone"` in next.config.ts so the runner image
# only needs the traced server bundle, not the full node_modules tree.

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ============================================
# Dependencies — install all deps (including devDeps for the build)
# ============================================
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ============================================
# Builder — compile Next.js with standalone output
# ============================================
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ============================================
# Production runner — minimal image that serves the standalone bundle
# ============================================
FROM base AS production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user for the runtime
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Public static assets (served by the standalone server)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Standalone server + traced node_modules, plus the static asset directory
# that `server.js` expects at ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Alpine has wget but not curl; probe the root path for any HTTP response.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --quiet --tries=1 --spider --server-response http://127.0.0.1:3000/ 2>&1 | grep -q "HTTP/" || exit 1

CMD ["node", "server.js"]
