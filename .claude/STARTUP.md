# Startup Guide

*Last updated: 2025-11-09 22:30*

Complete setup guide and troubleshooting for PromoAtlas PIM.

## Current Status ✅

**System is operational as of 2025-11-02 20:40:**
- ✅ Backend running on http://localhost:1337
- ✅ Frontend running on http://localhost:3001
- ✅ Database: PostgreSQL (Neon) connected successfully
- ✅ Queue System: BullMQ with 3 workers active
  - supplier-sync (concurrency: 1)
  - product-family (concurrency: 3)
  - image-upload (concurrency: 10)
- ✅ Redis: Upstash connected
- ✅ Storage: Cloudflare R2 (data-vault bucket)
- ✅ All TypeScript compilation errors resolved
- ✅ Product → ProductVariant hierarchy fully implemented

## Prerequisites

- **Node.js**: 18.0.0 - 22.x.x
- **npm**: Latest version (comes with Node)
- **PostgreSQL**: Neon account or local PostgreSQL instance
- **Cloudflare R2**: Account with R2 bucket created
- **Git**: For version control

## Initial Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd PromovereAtlasPim
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env  # If .env.example exists
# Or create .env manually (see Environment Variables section)

# Build Strapi admin panel
npm run build

# Start development server
npm run develop
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create environment file (if needed)
echo "VITE_API_URL=http://localhost:1337/api" > .env

# Start development server
npm run dev
```

## Environment Variables

### Backend (.env)

**Required variables:**

```env
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://username:password@host:5432/database?sslmode=require
DATABASE_CLIENT=postgres

# Cloudflare R2 Storage
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=promo-atlas-images
R2_PUBLIC_URL=https://your-bucket.account.r2.cloudflarestorage.com
R2_ENDPOINT=https://account.r2.cloudflarestorage.com

# Strapi Security Keys (generate using: node -e "console.log(require('crypto').randomBytes(16).toString('base64'))")
APP_KEYS=key1,key2,key3,key4
ADMIN_JWT_SECRET=your_admin_jwt_secret
API_TOKEN_SALT=your_api_token_salt
TRANSFER_TOKEN_SALT=your_transfer_token_salt
JWT_SECRET=your_jwt_secret

# Server Configuration
HOST=0.0.0.0
PORT=1337
```

**Optional variables:**

```env
# Node Environment
NODE_ENV=development  # or 'production'

# Strapi Admin URL (for production)
ADMIN_URL=https://admin.yourdomain.com

# Public URL (for production)
PUBLIC_URL=https://yourdomain.com
```

### Frontend (.env)

**Optional variables:**

```env
# Backend API URL (defaults to '/api' if not set)
VITE_API_URL=http://localhost:1337/api
```

**Note**: In development, Vite proxy handles API requests, so this variable is optional.

### Getting Credentials

**Neon PostgreSQL**:
1. Sign up at https://neon.tech
2. Create a new project
3. Copy connection string from project dashboard
4. Use in `DATABASE_URL` variable

**Cloudflare R2**:
1. Sign up at https://dash.cloudflare.com
2. Navigate to R2 → Create bucket
3. Generate API token: R2 → Manage R2 API Tokens → Create API Token
4. Copy Access Key ID and Secret Access Key
5. Bucket URL format: `https://[bucket-name].[account-id].r2.cloudflarestorage.com`

**Strapi Security Keys**:
```bash
# Generate random keys
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"
# Run this 4 times for APP_KEYS, or once for each secret
```

## Development Workflow

### Starting Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run develop
```
- Backend available at: http://localhost:1337
- Admin panel at: http://localhost:1337/admin
- Auto-reloads on file changes

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
- Frontend available at: http://localhost:3001
- Hot module replacement (HMR) enabled
- Proxy to backend at http://localhost:1337

### First-Time Admin Setup

1. Start backend: `cd backend && npm run develop`
2. Navigate to http://localhost:1337/admin
3. Create admin account (first time only)
4. You're now logged into the Strapi admin panel

### Running Promidata Sync

**Via Admin Panel:**
1. Log in to Strapi admin: http://localhost:1337/admin
2. Navigate to Content Manager → Promidata Syncs
3. Create new sync entry
4. Click "Start Sync" button

**Via API (using curl):**
```bash
# Get admin JWT token first (login via admin panel, check browser DevTools → Application → Local Storage)
JWT_TOKEN="your_jwt_token"

# Start sync for all active suppliers
curl -X POST http://localhost:1337/api/promidata-sync/start \
  -H "Authorization: Bearer $JWT_TOKEN"

# Start sync for specific supplier
curl -X POST http://localhost:1337/api/promidata-sync/start \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"supplierId": 1}'
```

**Bootstrap Suppliers:**
Suppliers are automatically created from Promidata on first run (56 suppliers A23-A618).

## Database Management

### Using Neon MCP Tools

```bash
# List all tables
mcp__neon__get_database_tables

# Describe product schema
mcp__neon__describe_table_schema --table products

# Run custom SQL
mcp__neon__run_sql --sql "SELECT COUNT(*) FROM products WHERE is_active = true"

# Prepare migration
mcp__neon__prepare_database_migration --description "Add new field to products"

# Complete migration
mcp__neon__complete_database_migration --migration_id <id>
```

### Manual Database Access

**Via Neon Dashboard:**
1. Log in to Neon dashboard
2. Navigate to your project
3. Click "SQL Editor"
4. Run queries directly

**Via psql (PostgreSQL CLI):**
```bash
psql "$DATABASE_URL"
```

### Common Database Operations

**Check product count:**
```sql
SELECT COUNT(*) FROM products;
```

**Check sync status:**
```sql
SELECT code, last_sync_date, last_sync_status, products_count
FROM suppliers
WHERE is_active = true;
```

**Reset sync (force full re-sync):**
```sql
UPDATE products SET promidata_hash = NULL;
```

## Common Commands

### Backend Commands

```bash
cd backend

# Development
npm run develop          # Start with auto-reload
npm run console          # Open Strapi console

# Building
npm run build           # Build admin panel

# Production
npm run start           # Start production server

# Deployment
npm run deploy          # Deploy to configured environment

# Strapi CLI
npm run strapi -- --help                    # Show Strapi CLI help
npm run strapi generate                     # Generate new content type/controller/service
npm run strapi content-types:list          # List all content types
npm run strapi admin:create-user            # Create admin user
```

### Frontend Commands

```bash
cd frontend

# Development
npm run dev             # Start Vite dev server (port 3001)

# Building
npm run build           # Build for production (output: dist/)
npm run preview         # Preview production build

# Linting
npm run lint            # Run ESLint
```

## Testing

### Backend Testing

```bash
cd backend

# Test Promidata sync
node scripts/test-promidata-sync.js

# Test R2 connectivity
node scripts/test-r2.js
```

### Frontend Testing

```bash
cd frontend

# No test framework configured yet
# TODO: Add Vitest or Jest for unit tests
# TODO: Add Playwright for E2E tests (MCP available)
```

## Port Configuration

| Service | Port | URL |
|---------|------|-----|
| Backend (Strapi) | 1337 | http://localhost:1337 |
| Backend Admin | 1337 | http://localhost:1337/admin |
| Backend API | 1337 | http://localhost:1337/api |
| Frontend (Vite) | 3001 | http://localhost:3001 |

**Changing Ports:**

Backend (`backend/config/server.ts`):
```typescript
export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  // ...
});
```

Frontend (`frontend/vite.config.ts`):
```typescript
export default defineConfig({
  server: {
    port: 3001,  // Change this
    proxy: {
      '/api': {
        target: 'http://localhost:1337',  // Update if backend port changes
        // ...
      }
    }
  }
});
```

## Production Deployment

### Backend Deployment

**Build:**
```bash
cd backend
npm run build
```

**Environment:**
- Set `NODE_ENV=production`
- Use production DATABASE_URL (Neon)
- Configure R2 with production credentials
- Set secure APP_KEYS and secrets

**Start:**
```bash
npm run start
```

**Docker Deployment:**
```bash
# Build Docker image
docker build -t promo-atlas-backend -f Dockerfile .

# Run container
docker run -p 1337:1337 --env-file .env promo-atlas-backend
```

### Frontend Deployment (Vercel)

**Build:**
```bash
cd frontend
npm run build
# Output: dist/
```

**Vercel Configuration** (`vercel.json`):
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Environment Variables:**
- Set `VITE_API_URL` to production backend URL

**Deploy:**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend
vercel --prod
```

## Troubleshooting

### Backend Issues

**Issue: Database connection failed (ECONNRESET)**
```
Error: read ECONNRESET
    at TCP.onStreamRead (node:internal/stream_base_commons:218:20)
```
**Cause**: SSL certificate validation issue with Neon PostgreSQL

**Solution:**
1. **First, verify credentials and connectivity:**
   ```bash
   # Test with psql
   PGPASSWORD="your_password" psql -h your-host.neon.tech -U neondb_owner -d neondb -c "SELECT 1;"

   # Test port reachability
   timeout 5 bash -c 'cat < /dev/null > /dev/tcp/your-host.neon.tech/5432'
   ```

2. **If both work but Node.js fails → SSL certificate issue**

   The problem is `rejectUnauthorized: true` in `backend/config/database.ts`.

   **Fix**: Update `backend/config/database.ts` line 29:
   ```typescript
   postgres: {
     connection: {
       connectionString: env('DATABASE_URL'),
       ssl: env.bool('DATABASE_SSL', true) ? {
         rejectUnauthorized: false, // IMPORTANT: Required for Neon
       } : false,
     },
     // ...
   }
   ```

3. **Restart backend:**
   ```bash
   cd backend
   npm run develop
   ```

**See Also**: GOTCHAS.md "Neon PostgreSQL SSL Connection Reset" for detailed explanation

---

**Issue: Database connection refused**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution:**
- Check `DATABASE_URL` is correct in `.env`
- Ensure Neon database is running (check dashboard)
- Verify network connectivity
- Check if DATABASE_CLIENT=postgres is set

**Issue: R2 upload failed**
```
Error: S3 upload failed - Access Denied
```
**Solution:**
- Verify R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY
- Check R2_BUCKET_NAME is correct
- Ensure R2 API token has write permissions
- Check R2_ENDPOINT format: `https://[account-id].r2.cloudflarestorage.com`

**Issue: Promidata sync timeout**
```
Error: Request timeout after 30000ms
```
**Solution:**
- Check internet connectivity
- Verify Promidata API is accessible: `curl https://promi-dl.de/...`
- Increase timeout in service (default: 30s)
- Try syncing single supplier instead of all

**Issue: Strapi admin panel won't load**
```
Error: Cannot GET /admin
```
**Solution:**
- Run `npm run build` to build admin panel
- Check PORT=1337 in `.env`
- Ensure `npm run develop` is running
- Clear browser cache

### Frontend Issues

**Issue: API requests fail with 404**
```
Error: GET http://localhost:3001/api/products 404 (Not Found)
```
**Solution:**
- Ensure backend is running on port 1337
- Check Vite proxy configuration in `vite.config.ts`
- Verify `VITE_API_URL` in `.env` (if set)
- Check browser DevTools → Network tab for actual request URL

**Issue: Products not displaying**
```
Products array is empty
```
**Solution:**
- Check backend has products: http://localhost:1337/api/products
- Verify permissions are set (products should be publicly readable)
- Check browser console for errors
- Ensure backend is running

**Issue: Images not loading**
```
Image 404 errors
```
**Solution:**
- Check R2 bucket has public read access
- Verify R2_PUBLIC_URL is correct in backend `.env`
- Check image URLs in API response
- Test R2 URL directly in browser

### Development Environment Issues

**Issue: Port 1337 already in use**
```
Error: listen EADDRINUSE: address already in use :::1337
```
**Solution:**
```bash
# Find and kill process using port 1337
lsof -ti:1337 | xargs kill -9

# Or change PORT in backend/.env
PORT=1338
```

**Issue: Port 3001 already in use**
```
Error: Port 3001 is already in use
```
**Solution:**
```bash
# Find and kill process
lsof -ti:3001 | xargs kill -9

# Or change port in vite.config.ts
```

**Issue: npm install fails**
```
Error: ERESOLVE unable to resolve dependency tree
```
**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install

# If still failing, use --legacy-peer-deps
npm install --legacy-peer-deps
```

### Permission Issues

**Issue: Cannot create/update products**
```
Error: Forbidden
```
**Solution:**
- Log in to Strapi admin
- Navigate to Settings → Users & Permissions → Roles → Public
- Enable find/findOne for product/category/supplier
- Save changes

**Issue: Sync operation fails with 403**
```
Error: Forbidden - Insufficient permissions
```
**Solution:**
- Ensure you're logged in as admin
- Check JWT token is valid
- Sync operations are admin-only (requires authentication)

## Performance Optimization

### Backend Optimization

**Database Connection Pooling:**
```typescript
// config/database.ts
connection: {
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
  }
}
```

**Enable Query Logging (development only):**
```typescript
// config/database.ts
debug: env('NODE_ENV') === 'development'
```

### Frontend Optimization

**Build Optimization:**
```bash
# Analyze bundle size
npm run build -- --mode production

# Check dist/ folder size
du -sh dist/
```

**Image Lazy Loading:**
Already implemented in ProductCard component with `loading="lazy"` attribute.

## Useful Development Tools

### VS Code Extensions

- **ESLint**: Linting
- **Prettier**: Code formatting
- **TypeScript Vue Plugin (Volar)**: TypeScript support
- **REST Client**: Test API endpoints

### Browser Extensions

- **React Developer Tools**: Debug React components
- **JSON Viewer**: Format API responses
- **Redux DevTools**: (if Redux added)

### MCP Tools Available

- **Neon MCP**: Database operations
- **Strapi MCP**: Content management
- **Playwright MCP**: Browser automation and testing
- **Datadog MCP**: Performance monitoring
- **Sentry MCP**: Error tracking

## Monitoring & Logging

### Backend Logging

**Console Logs:**
```bash
cd backend
npm run develop

# Logs appear in terminal
# Use strapi.log.info() and strapi.log.error() in code
```

**Log Levels:**
- `strapi.log.info()` - General information
- `strapi.log.warn()` - Warnings
- `strapi.log.error()` - Errors
- `strapi.log.debug()` - Debug information

### Frontend Logging

**Browser Console:**
- Open DevTools → Console
- Check for errors, warnings, and logs
- Use `console.log()`, `console.error()`, `console.warn()`

**Network Monitoring:**
- DevTools → Network tab
- Filter by "Fetch/XHR" to see API requests
- Check response status codes and payloads

### Queue Monitoring

**Bull Board Dashboard** (Recommended for monitoring):
- **Access**: Strapi Admin → Click "Queue Dashboard" in sidebar
- **URL**: http://localhost:1337/admin/queue-dashboard
- **Features**:
  - Real-time queue statistics for all 3 queues
  - Job counts (waiting, active, completed, failed)
  - Visual queue health overview
  - Retry failed jobs
  - View job logs and error stack traces
  - Clean old completed jobs
- **Authentication**: Automatic (uses Strapi admin session cookie)
- **Best for**: Quick overview, real-time monitoring, visual inspection

**Job Manager** (Detailed job management):
- **Access**: Strapi Admin → Click "Job Manager" in sidebar
- **URL**: http://localhost:1337/admin/queue-management
- **Features**:
  - Search and filter jobs by ID, status, queue name
  - View detailed job data and results
  - Pause/resume individual queues
  - Retry or delete specific jobs
  - Export job information
- **Best for**: Debugging specific jobs, detailed investigation

**API Access** (Programmatic):
```bash
# Get all queue stats
curl http://localhost:1337/api/queue-manager/stats

# Get jobs for a specific queue
curl http://localhost:1337/api/queue-manager/jobs/supplier-sync/active
```

## Next Steps After Setup

1. **Create Admin Account**: Visit http://localhost:1337/admin
2. **Bootstrap Suppliers**: Suppliers auto-created on first run
3. **Run First Sync**: Start Promidata sync via admin panel
4. **Monitor Queues**: Click "Queue Dashboard" in sidebar to see real-time queue status
5. **Test Frontend**: Visit http://localhost:3001 to see products
6. **Explore Admin Panel**: Familiarize yourself with content types
7. **Check Documentation**: Read `.claude/ARCHITECTURE.md` and `.claude/PATTERNS.md`

---

*Keep this document updated with new setup steps, troubleshooting solutions, and deployment procedures.*
