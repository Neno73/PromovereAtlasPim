# Coolify Deployment Guide

*Last updated: 2025-11-06*

Complete guide for deploying PromoAtlas PIM to Coolify with CI/CD automation.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Initial Setup](#initial-setup)
4. [Dashboard Configuration](#dashboard-configuration)
5. [Environment Variables](#environment-variables)
6. [Deployment Workflow](#deployment-workflow)
7. [CLI Automation](#cli-automation)
8. [Monitoring & Troubleshooting](#monitoring--troubleshooting)
9. [Database Strategy](#database-strategy)
10. [Scaling & Performance](#scaling--performance)

---

## Overview

### Architecture

PromoAtlas PIM deploys as **single container** with integrated workers:

```
┌─────────────────────────────────────────┐
│         Coolify Application             │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │      Strapi Backend + Workers   │   │
│  │           Port :1337            │   │
│  │                                 │   │
│  │  • API Server                   │   │
│  │  • BullMQ Workers (3):          │   │
│  │    - supplier-sync (conc: 1)    │   │
│  │    - product-family (conc: 3)   │   │
│  │    - image-upload (conc: 10)    │   │
│  └─────────────────────────────────┘   │
│                  │                      │
└──────────────────┼──────────────────────┘
                   │
      ┌────────────┴───────────┐
      │                        │
      ▼                        ▼
  ┌─────────┐              ┌─────────┐
  │  Neon   │              │ Upstash │
  │PostgreSQL│             │  Redis  │
  └─────────┘              └─────────┘
```

**Single Container Architecture:**
- **Strapi Backend**: Main API server (port 1337)
- **Integrated Workers**: BullMQ workers run inside Strapi process
  - Workers start automatically during Strapi bootstrap (`src/index.ts`)
  - Full access to Strapi context (services, database, lifecycle hooks)
  - No "strapi is not defined" errors

**External Dependencies:**
- **Database**: Neon PostgreSQL (serverless)
- **Queue**: Upstash Redis (serverless)
- **Storage**: Cloudflare R2 (object storage)

---

## Prerequisites

### Required Accounts

1. **Coolify Instance**
   - Self-hosted or cloud-hosted Coolify
   - Access to dashboard
   - GitHub integration configured

2. **Neon Database** (Current - Recommended)
   - Free tier: 0.5 GB storage, 191.9 compute hours/month
   - Staging database branch (copy of production)
   - Production database (main branch)

3. **Upstash Redis**
   - Free tier: 10,000 commands/day
   - Redis URL for BullMQ queues

4. **Cloudflare R2**
   - Account with R2 bucket created
   - Access keys generated
   - Separate buckets for staging/production

5. **GitHub Repository**
   - Connected to Coolify
   - Webhook configured

### Local Setup

Before deploying, ensure local development works:

```bash
# Backend builds successfully
cd backend
npm run build

# Docker Compose works locally (workers start automatically inside Strapi)
cd ..
docker-compose -f docker-compose.coolify.yml up
```

---

## Initial Setup

### Step 1: Prepare External Services

#### Neon Database Setup

**Create Staging Database:**
1. Log in to Neon dashboard: https://console.neon.tech
2. Navigate to your project
3. Click "Branches" → "Create Branch"
4. Name: `staging`
5. Copy connection string → Save for later

**Production Database:**
- Use main branch connection string

**Connection Strings Format:**
```
postgresql://user:password@ep-xxx-pooler.c-2.eu-central-1.aws.neon.tech/db?sslmode=require
```

#### Upstash Redis Setup

1. Log in to Upstash: https://console.upstash.com
2. Create Redis database (or use existing)
3. Copy credentials:
   - `REDIS_URL`: rediss://default:password@host:6379
   - `UPSTASH_REDIS_REST_URL`: https://host.upstash.io
   - `UPSTASH_REDIS_REST_TOKEN`: token

#### Cloudflare R2 Setup

**Create Buckets:**
1. Cloudflare Dashboard → R2
2. Create bucket: `promoatlas-staging`
3. Create bucket: `promoatlas-production`
4. Set public access (Settings → Public Access → Allow)

**Generate API Tokens:**
1. R2 → Manage R2 API Tokens
2. Create API Token (Read & Write permissions)
3. Copy:
   - Access Key ID
   - Secret Access Key
   - Endpoint URL
   - Public URL

### Step 2: Generate Strapi Secrets

Generate unique secrets for **each environment** (staging and production):

```bash
# Run this 4 times to generate APP_KEYS
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"

# Generate other secrets
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"  # API_TOKEN_SALT
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"  # ADMIN_JWT_SECRET
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"  # TRANSFER_TOKEN_SALT
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"  # JWT_SECRET
```

**Important:** Use **different secrets** for staging and production!

---

## Dashboard Configuration

### Part 1: Create Staging Application

#### 1. Navigate to Coolify Dashboard

- URL: https://your-coolify-instance.com
- Log in with your credentials

#### 2. Create New Application

1. Click **"+ New Resource"** → **"Application"**
2. Select **"Public Repository"** (or your connected GitHub repo)

#### 3. Configure Application Settings

**Basic Settings:**
- **Name**: `PromoAtlas Staging`
- **Project**: Select your project
- **Environment**: Create new environment "Staging"

**Source Configuration:**
- **Repository**: `https://github.com/your-username/PromovereAtlasPim`
- **Branch**: `develop`
- **Base Directory**: `.` (root)
- **Watch Paths**: `backend/**,docker-compose.coolify.yml` (optional - only rebuild on backend changes)

**Build Configuration:**
- **Build Pack**: `Docker Compose`
- **Docker Compose File**: `docker-compose.coolify.yml`
- **Docker Compose Service**: Leave empty (builds all services)

**Network & Domains:**
- **Ports**: `1337` (for strapi service)
- **Domain**: Let Coolify auto-generate or use custom domain

**Health Check:**
- **Enabled**: Yes
- **Path**: `/_health`
- **Port**: `1337`
- **Method**: `GET`

#### 4. Save Configuration

Click **"Save"** → Coolify creates the application

---

### Part 2: Configure Environment Variables (Staging)

1. Navigate to application → **"Environment Variables"** tab

2. Click **"+ Add"** for each variable below:

**Server Configuration:**
```
HOST=0.0.0.0
PORT=1337
NODE_ENV=production
```

**Strapi Secrets (Use generated values):**
```
APP_KEYS=key1,key2,key3,key4
API_TOKEN_SALT=your_staging_token_salt
ADMIN_JWT_SECRET=your_staging_admin_secret
TRANSFER_TOKEN_SALT=your_staging_transfer_salt
JWT_SECRET=your_staging_jwt_secret
```

**Database (Neon Staging Branch):**
```
DATABASE_CLIENT=postgres
DATABASE_URL=postgresql://user:password@ep-xxx-pooler.c-2.eu-central-1.aws.neon.tech/db?sslmode=require
DATABASE_HOST=ep-xxx-pooler.c-2.eu-central-1.aws.neon.tech
DATABASE_PORT=5432
DATABASE_NAME=neondb
DATABASE_USERNAME=neondb_owner
DATABASE_PASSWORD=your_password
DATABASE_SSL=true
DATABASE_SCHEMA=public
```

**Cloudflare R2 (Staging Bucket):**
```
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=promoatlas-staging
R2_ENDPOINT=https://account-id.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://pub-xxx.r2.dev
```

**Cloudflare Account:**
```
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_RAG_NAME=promoatlas-rag-staging
```

**Redis (Upstash):**
```
REDIS_URL=rediss://default:password@host.upstash.io:6379
UPSTASH_REDIS_REST_URL=https://host.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
```

**Promidata:**
```
PROMIDATA_BASE_URL=https://promi-dl.de/Profiles/Live/your-profile-id
```

**BullMQ Configuration:**
```
BULLMQ_CONCURRENCY_FAMILIES=3
BULLMQ_CONCURRENCY_IMAGES=10
BULLMQ_JOB_TIMEOUT_SUPPLIER=1800000
BULLMQ_JOB_TIMEOUT_FAMILY=300000
BULLMQ_JOB_TIMEOUT_IMAGE=120000
```

3. Mark sensitive variables as **"Build Secret"** (lock icon):
   - All `SECRET` and `PASSWORD` fields
   - Database credentials
   - API tokens

4. Click **"Save Environment Variables"**

---

### Part 3: Deploy Staging

1. Click **"Deploy"** button
2. Monitor build logs in real-time
3. Wait for "Deployment successful" message

**Expected Build Time:**
- First build: 5-10 minutes (downloads dependencies)
- Subsequent builds: 2-5 minutes (uses cache)

**Verify Deployment:**
1. Check health endpoint: `https://your-staging-domain.com/_health`
2. Should return: `{"status":"ok","timestamp":"2025-11-05T..."}`

3. Check logs (single container with integrated workers):
   - Look for "Server started on port 1337"
   - Look for "✅ Started 3 workers: supplier-sync, product-family, image-upload"
   - Both API and worker logs are in the same Strapi container

---

### Part 4: Create Production Application

Repeat Steps 1-3 with **production settings**:

**Differences from Staging:**
- **Name**: `PromoAtlas Production`
- **Branch**: `main`
- **Environment**: Create new "Production"
- **Database URL**: Neon production (main branch)
- **R2 Bucket**: `promoatlas-production`
- **Strapi Secrets**: **Different values** from staging
- **Domain**: Your production domain (e.g., `api.promoatlas.com`)

---

## Environment Variables

### Complete List

See `.env.coolify.example` for full template with explanations.

**Critical Variables:**
- `DATABASE_URL` - Database connection string
- `REDIS_URL` - Redis connection for BullMQ
- `APP_KEYS` - Strapi session encryption keys
- `R2_*` - Cloudflare R2 storage credentials

**Optional Variables:**
- `BULLMQ_CONCURRENCY_*` - Worker concurrency (defaults work well)
- `CLOUDFLARE_*` - AutoRAG integration (if using)

### Environment Variable Management

**Coolify Features:**
- **Build Secrets**: Encrypted at rest
- **Environment Inheritance**: Share common vars across apps
- **Variable Groups**: Group related variables

**Best Practices:**
1. Never commit secrets to git
2. Use different secrets for staging/production
3. Rotate secrets regularly (every 90 days)
4. Document which variables are required vs optional

---

## Deployment Workflow

### Automatic Deployment (Recommended)

**Staging (develop branch):**
1. Developer pushes to `develop` branch
2. GitHub webhook triggers Coolify
3. Coolify builds `docker-compose.coolify.yml`
4. Deploys to staging environment
5. Health check verifies deployment
6. Team tests on staging URL

**Production (main branch):**
1. Create PR: `develop` → `main`
2. Code review and approval
3. Merge to `main`
4. GitHub webhook triggers Coolify
5. **Manual approval gate** (configure in Coolify)
6. Coolify builds and deploys to production
7. Health check verifies deployment
8. Monitor production logs

### Manual Deployment

**Via Coolify Dashboard:**
1. Navigate to application
2. Click **"Deploy"** button
3. Monitor build logs
4. Verify health check

**Via Coolify CLI:**
```bash
# Install CLI
npm install -g coolify-cli

# Deploy application
coolify app deploy <app-uuid>

# Monitor logs
coolify app logs <app-uuid> --follow
```

### Rollback Procedure

**Via Dashboard:**
1. Navigate to application → **"Deployments"** tab
2. Find previous successful deployment
3. Click **"Redeploy"**

**Via CLI:**
```bash
# List deployments
coolify app deployments <app-uuid>

# Rollback to previous
coolify app rollback <app-uuid> --version <deployment-id>
```

---

## CLI Automation

### Install Coolify CLI

```bash
# Via npm
npm install -g coolify-cli

# Or via Go
go install github.com/coollabsio/coolify-cli@latest
```

### Configure CLI

```bash
# Login to Coolify
coolify login https://your-coolify-instance.com

# Enter API token (get from dashboard: Security → API Tokens)
```

### Common CLI Commands

**Application Management:**
```bash
# List all applications
coolify app list

# Get application details
coolify app get <app-uuid>

# Deploy application
coolify app deploy <app-uuid>

# Restart application
coolify app restart <app-uuid>

# View logs
coolify app logs <app-uuid> --follow

# Execute command in container
coolify app exec <app-uuid> --service strapi --command "npm run strapi console"
```

**Environment Variables:**
```bash
# List environment variables
coolify app env list <app-uuid>

# Set environment variable
coolify app env set <app-uuid> --key DATABASE_URL --value "postgresql://..."

# Sync from .env file
coolify app env sync <app-uuid> --file .env.production
```

**Database Operations:**
```bash
# List databases
coolify database list

# Backup database
coolify database backup <db-uuid>

# Restore database
coolify database restore <db-uuid> --file backup.sql
```

### Deployment Scripts

Create `scripts/deploy-to-coolify.sh`:

```bash
#!/bin/bash
set -e

# Configuration
STAGING_APP_UUID="your-staging-app-uuid"
PRODUCTION_APP_UUID="your-production-app-uuid"

# Function to deploy
deploy() {
  local APP_UUID=$1
  local ENV_NAME=$2

  echo "🚀 Deploying PromoAtlas to $ENV_NAME..."

  # Deploy
  coolify app deploy $APP_UUID

  # Wait for deployment
  echo "⏳ Waiting for deployment to complete..."
  sleep 30

  # Check health
  echo "🏥 Checking health..."
  coolify app health $APP_UUID

  echo "✅ Deployment to $ENV_NAME complete!"
}

# Parse arguments
case "$1" in
  staging)
    deploy $STAGING_APP_UUID "Staging"
    ;;
  production)
    deploy $PRODUCTION_APP_UUID "Production"
    ;;
  *)
    echo "Usage: $0 {staging|production}"
    exit 1
    ;;
esac
```

Make executable:
```bash
chmod +x scripts/deploy-to-coolify.sh
```

Run:
```bash
# Deploy to staging
./scripts/deploy-to-coolify.sh staging

# Deploy to production
./scripts/deploy-to-coolify.sh production
```

---

## Monitoring & Troubleshooting

### Health Checks

**Endpoint:** `GET https://your-domain.com/_health`

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-05T12:00:00.000Z"
}
```

**Check from CLI:**
```bash
curl https://your-staging-domain.com/_health
```

### Viewing Logs

**Via Dashboard:**
1. Navigate to application
2. Click **"Logs"** tab
3. View Strapi service logs (includes both API and worker output)

**Via CLI:**
```bash
# All logs (includes both API and worker logs)
coolify app logs <app-uuid>

# Follow logs
coolify app logs <app-uuid> --follow

# Filter by service (only strapi service exists now)
coolify app logs <app-uuid> --service strapi

# Last 100 lines
coolify app logs <app-uuid> --tail 100
```

**Via Docker (if SSH access to server):**
```bash
# List containers
docker ps | grep promoatlas

# View Strapi logs (includes worker logs)
docker logs promoatlas-backend

# Follow logs
docker logs promoatlas-backend --follow

# Last 100 lines
docker logs promoatlas-backend --tail 100
```

### Common Issues

#### Issue 1: Build Fails - "ECONNRESET" Database Error

**Symptoms:**
- Build fails during Strapi initialization
- Error: `read ECONNRESET` or `connection timeout`

**Causes:**
- Incorrect DATABASE_URL
- Neon database not accessible
- SSL configuration issue

**Solution:**
```bash
# 1. Verify DATABASE_URL is correct in Coolify environment variables
# 2. Test connection from local machine
PGPASSWORD="your_password" psql -h ep-xxx-pooler.c-2.eu-central-1.aws.neon.tech -U neondb_owner -d neondb -c "SELECT 1;"

# 3. Ensure DATABASE_SSL=true for Neon
# 4. Check backend/config/database.ts has rejectUnauthorized: false
```

#### Issue 2: Images Not Uploading to R2

**Symptoms:**
- Products created without images
- R2 upload errors in logs

**Solution:**
```bash
# 1. Verify R2 credentials in environment variables
# 2. Test R2 access
aws s3 ls s3://promoatlas-staging --endpoint-url=https://account-id.r2.cloudflarestorage.com

# 3. Check R2 bucket permissions (must allow public read)
# 4. Verify R2_PUBLIC_URL is correct
```

#### Issue 3: Port 1337 Already in Use

**Symptoms:**
- Deployment fails with "port already in use"

**Solution:**
```bash
# Coolify should handle port mapping automatically
# If issue persists, check Coolify server:
ssh your-coolify-server
docker ps | grep 1337
# Stop conflicting container if found
```

#### Issue 4: Environment Variables Not Loading

**Symptoms:**
- Application starts but errors about missing env vars
- `undefined` values for variables

**Solution:**
```bash
# 1. Verify all variables are set in Coolify dashboard
# 2. Check variable names match exactly (case-sensitive)
# 3. Redeploy after changing variables
# 4. Check container environment
docker exec promoatlas-backend env | grep DATABASE_URL
```

#### Issue 5: Workers Connect to Localhost Instead of Upstash Redis

**Symptoms:**
- Logs show `ECONNREFUSED 127.0.0.1:6379`
- Workers fail to start
- Environment variable REDIS_URL is correctly set

**Causes:**
- Queue configuration not parsing Redis URL correctly
- Workers receiving wrong connection object type

**Solution:**
This issue was fixed in `backend/src/services/queue/queue-config.ts`. The fix:

1. **Removed Proxy Pattern**: Replaced Proxy wrapper with direct URL parsing
2. **Parse Redis URL Properly**: Extract host, port, username, password from `rediss://` URL
3. **Enable TLS**: Automatically detect TLS requirement from `rediss://` protocol
4. **Return ConnectionOptions**: Return properly typed object matching ioredis expectations

The `getRedisConnection()` function now:
- Parses `REDIS_URL` using JavaScript's `URL` class
- Extracts connection parameters (host, port, password, username)
- Enables TLS for `rediss://` URLs
- Returns plain object compatible with BullMQ/ioredis

**Verify Fix:**
```bash
# Check logs for successful worker startup
docker logs promoatlas-backend | grep "Started 3 workers"

# Should see:
# ✅ Started 3 workers:
#    - supplier-sync (concurrency: 1)
#    - product-family (concurrency: 3)
#    - image-upload (concurrency: 10)

# Verify no connection errors
docker logs promoatlas-backend | grep ECONNREFUSED
# Should return nothing
```

**Important:** Ensure `REDIS_URL` uses `rediss://` (with SSL) for Upstash:
```
REDIS_URL=rediss://default:password@your-host.upstash.io:6379
```

#### Issue 6: Public URL Returns 404 - Network Routing

**Symptoms:**
- Deployment succeeds
- Container is running and healthy
- `localhost:1337` works on server
- Public URL returns 404 Not Found

**Causes:**
- Container on custom network instead of Coolify's network
- Coolify's reverse proxy (Caddy/Traefik) can't reach container

**Solution:**
The fix is already applied in `docker-compose.coolify.yml`. The networks section must use:

```yaml
networks:
  promoatlas:
    external: true
    name: coolify  # MUST use Coolify's network
```

**DO NOT** create a custom network:
```yaml
# ❌ WRONG - This isolates container from Coolify
networks:
  promoatlas:
    driver: bridge
    name: promoatlas-network
```

**Verify Fix:**
```bash
# Check container is on coolify network
docker inspect promoatlas-backend --format '{{range $net, $conf := .NetworkSettings.Networks}}{{$net}}{{end}}'
# Should output: coolify

# Test public URL
curl -I https://your-domain.com/_health
# Should return HTTP 200
```

**Rollback:**
If this breaks your deployment:
1. Check if Coolify network exists: `docker network ls | grep coolify`
2. If not, create it: `docker network create coolify`
3. Redeploy the application

### Performance Monitoring

**Coolify Built-in Metrics:**
- CPU usage
- Memory usage
- Network I/O
- Disk usage

**Worker Monitoring:**

Workers start automatically with Strapi and log their status:
- Look for "✅ Started 3 workers: supplier-sync, product-family, image-upload" in logs
- Workers use Strapi's logging system (`strapi.log.info()`)
- Check Redis queue lengths to monitor job processing

---

## Database Strategy

### Current: Neon PostgreSQL (Recommended)

**Advantages:**
- Serverless (auto-scales)
- Database branching (instant staging copies)
- Automatic backups
- Connection pooling via Hyperdrive
- Free tier: 0.5 GB, 191.9 compute hours/month

**Cost:**
- Free tier: $0/month
- Launch plan: $5-8/month (if exceeding free tier)

**Setup:**
- Staging: Neon branch (copy of production)
- Production: Neon main branch

### Alternative: Coolify PostgreSQL

**When to Consider:**
- Exceeding Neon free tier consistently
- Want to avoid external dependencies
- Already have robust backup strategy

**Setup in Coolify:**
1. Navigate to Resources → **"+ New Resource"** → **"Database"**
2. Select **"PostgreSQL"**
3. Configure:
   - Name: `promoatlas-db`
   - Version: `15-alpine`
   - Root Password: Generate secure password
4. Enable **"Automated Backups"**
   - Schedule: Daily at 2 AM
   - Retention: 7 days
   - Backup to S3 (optional)

**Update Environment Variables:**
```
DATABASE_URL=postgresql://postgres:password@promoatlas-db:5432/promoatlas
DATABASE_HOST=promoatlas-db
DATABASE_PORT=5432
DATABASE_SSL=false
```

**Migration from Neon:**
```bash
# 1. Dump Neon database
pg_dump "$NEON_DATABASE_URL" -Fc -f backup.dump

# 2. Restore to Coolify PostgreSQL
pg_restore -h coolify-server -U postgres -d promoatlas backup.dump

# 3. Update DATABASE_URL in Coolify
# 4. Redeploy
```

---

## Scaling & Performance

### Current Resources

**Default Allocation:**
- **Strapi (with integrated workers)**: 1 GB RAM, 1.0 CPU
  - API server uses ~512 MB
  - 3 BullMQ workers share remaining memory
  - Workers are lightweight (concurrent job processing)

**Total per replica**: ~1 GB RAM, 1.0 CPU

### Scaling Strategies

#### Vertical Scaling (More Resources)

1. Navigate to application → **"Resources"** tab
2. Adjust:
   - **Memory Limit**: Increase to 1 GB for Strapi
   - **CPU Limit**: Increase to 1.0 CPU

#### Horizontal Scaling (More Replicas)

**Scaling via Coolify:**
1. Navigate to application → **"Resources"** tab
2. Increase **"Replicas"** count (e.g., from 1 to 3)
3. Coolify automatically adds load balancer
4. Each replica runs its own set of workers

**How it works:**
- Each Strapi replica starts its own 3 BullMQ workers
- BullMQ automatically distributes jobs across all workers via Redis
- Example: 3 replicas = 3 API servers + 9 total workers
- Workers are concurrency-limited (supplier-sync: 1, product-family: 3, image-upload: 10)
- No configuration changes needed - BullMQ handles distribution

**When to scale:**
- High API traffic: Add more replicas for better API response time
- Large sync jobs: More replicas = more parallel job processing
- Monitor queue length: If jobs are backing up, add replicas

### Performance Optimization

**1. Enable Persistent Storage (Optional):**

If using file uploads (currently using R2):
```yaml
# In docker-compose.coolify.yml
services:
  strapi:
    volumes:
      - strapi-uploads:/app/public/uploads
```

**2. Add Redis Cache (Optional):**

For query caching:
- Create Coolify Redis service
- Add to docker-compose.coolify.yml
- Configure in Strapi

**3. Database Connection Pooling:**

Already configured via Neon Hyperdrive.

**4. Monitor Queue Length:**

Check Redis queue sizes:
```bash
# Connect to Upstash Redis
redis-cli -u "$REDIS_URL"

# Check queue length
LLEN bull:supplier-sync:wait
LLEN bull:product-family:wait
LLEN bull:image-upload:wait
```

---

## GitHub Actions Integration (Optional)

Create `.github/workflows/deploy-coolify.yml`:

```yaml
name: Deploy to Coolify

on:
  push:
    branches:
      - main       # Production
      - develop    # Staging

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Determine environment
        id: env
        run: |
          if [ "${{ github.ref }}" == "refs/heads/main" ]; then
            echo "environment=production" >> $GITHUB_OUTPUT
            echo "app_uuid=${{ secrets.COOLIFY_PRODUCTION_APP_UUID }}" >> $GITHUB_OUTPUT
          else
            echo "environment=staging" >> $GITHUB_OUTPUT
            echo "app_uuid=${{ secrets.COOLIFY_STAGING_APP_UUID }}" >> $GITHUB_OUTPUT
          fi

      - name: Deploy to Coolify
        env:
          COOLIFY_API_TOKEN: ${{ secrets.COOLIFY_API_TOKEN }}
          COOLIFY_URL: ${{ secrets.COOLIFY_URL }}
        run: |
          curl -X POST "$COOLIFY_URL/api/v1/deploy/${{ steps.env.outputs.app_uuid }}" \
            -H "Authorization: Bearer $COOLIFY_API_TOKEN"

      - name: Wait for deployment
        run: sleep 60

      - name: Check health
        run: |
          if [ "${{ steps.env.outputs.environment }}" == "production" ]; then
            curl -f https://api.promoatlas.com/_health
          else
            curl -f https://staging.promoatlas.com/_health
          fi
```

**Required GitHub Secrets:**
- `COOLIFY_API_TOKEN` - Get from Coolify → Security → API Tokens
- `COOLIFY_URL` - Your Coolify instance URL
- `COOLIFY_STAGING_APP_UUID` - From Coolify app settings
- `COOLIFY_PRODUCTION_APP_UUID` - From Coolify app settings

---

## Next Steps

After successful deployment:

1. **Test Staging Thoroughly:**
   - Create test products
   - Run Promidata sync
   - Verify images upload to R2
   - Check worker logs for job processing

2. **Set Up Monitoring:**
   - Add Sentry for error tracking (optional)
   - Add Datadog for performance monitoring (optional)
   - Set up Coolify alerts for deployment failures

3. **Configure Custom Domains:**
   - Staging: `staging.promoatlas.com`
   - Production: `api.promoatlas.com`

4. **Set Up SSL Certificates:**
   - Coolify auto-provisions Let's Encrypt certificates
   - Verify HTTPS works

5. **Document Custom Procedures:**
   - Database migrations
   - Data seeding
   - Backup/restore procedures

6. **Train Team:**
   - How to view logs
   - How to trigger deployments
   - Rollback procedures

---

## Additional Resources

- **Coolify Documentation**: https://coolify.io/docs
- **Coolify API Reference**: https://coolify.io/docs/api-reference
- **Neon Documentation**: https://neon.tech/docs
- **Upstash Documentation**: https://docs.upstash.com
- **Cloudflare R2 Documentation**: https://developers.cloudflare.com/r2

---

*Keep this document updated as deployment procedures evolve.*
