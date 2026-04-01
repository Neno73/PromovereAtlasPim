# Multi-stage build for production-optimized Strapi 5
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Development stage
FROM base AS dev
WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
EXPOSE 1337
ENV NODE_ENV=development
CMD ["npm", "run", "develop"]

# Build stage
FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

# Set production environment for build
ENV NODE_ENV=production
ENV STRAPI_TELEMETRY_DISABLED=true

# Build Strapi
RUN npm run build

# Production stage
FROM base AS production
WORKDIR /app

# Create strapi user
RUN addgroup -g 1001 -S strapi && \
    adduser -S strapi -u 1001

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy built application (compiled TypeScript from dist/)
COPY --from=builder /app/dist/src ./src
COPY --from=builder /app/dist/config ./config
COPY --from=builder /app/dist/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/database ./database
COPY --from=builder /app/package*.json ./

# Create necessary directories and set permissions
RUN mkdir -p /app/.tmp && \
    chown -R strapi:strapi /app/.tmp /app/src /app/build /app/public /app/config /app/database /app/package*.json

# Run as root for now to avoid permission issues
# USER strapi

EXPOSE 1337
ENV NODE_ENV=production
ENV STRAPI_TELEMETRY_DISABLED=true

# Health check - waits for Strapi to fully start (90s) then checks connectivity
# Using 127.0.0.1 to avoid IPv6 issues, checking any response (including 404) means server is up
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD wget --quiet --tries=1 --spider --server-response http://127.0.0.1:1337/ 2>&1 | grep -q "HTTP/" || exit 1

CMD ["npm", "start"]

# Workers stage - for running BullMQ workers separately
FROM production AS workers
WORKDIR /app

# Workers don't need HTTP port exposure
# Remove healthcheck since workers don't have HTTP endpoint

# Run the standalone worker process (note: path includes 'src/')
CMD ["node", "dist/src/workers/start-workers.js"]