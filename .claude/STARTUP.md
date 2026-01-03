# Startup Guide

*Last updated: 2026-01-03*

Quick setup and operations for PromoAtlas PIM.

## Prerequisites

- Node.js 18-22
- Docker (for local Redis)
- Git

## Quick Start

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env  # Edit with your credentials
npm run build         # First time only
npm run develop       # Start with hot-reload
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev           # Starts on port 3000+
```

### 3. Local Redis (Dev)

```bash
docker run -d --name promoatlas-redis -p 6380:6379 redis:alpine
```

## Environment Variables

### Backend (.env) - Required

```env
# Database (Coolify PostgreSQL)
DATABASE_URL=postgres://postgres:password@46.62.239.73:5432/postgres?sslmode=require
DATABASE_CLIENT=postgres

# Redis (local dev)
REDIS_URL=redis://localhost:6380/0

# Cloudflare R2
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=promo-atlas-images
R2_PUBLIC_URL=https://bucket.account.r2.cloudflarestorage.com
R2_ENDPOINT=https://account.r2.cloudflarestorage.com

# Strapi (generate: node -e "console.log(require('crypto').randomBytes(16).toString('base64'))")
APP_KEYS=key1,key2,key3,key4
ADMIN_JWT_SECRET=xxx
API_TOKEN_SALT=xxx
TRANSFER_TOKEN_SALT=xxx
JWT_SECRET=xxx

HOST=0.0.0.0
PORT=1337
```

## Service URLs

| Service | URL |
|---------|-----|
| Backend | http://localhost:1337 |
| Admin Panel | http://localhost:1337/admin |
| API | http://localhost:1337/api |
| Frontend | http://localhost:3000 |
| Queue Dashboard | http://localhost:1337/admin/queue-dashboard |
| Gemini Dashboard | http://localhost:1337/admin/gemini-dashboard |

## Common Commands

```bash
# Backend
cd backend
npm run develop      # Dev server (auto-reload)
npm run build        # Build admin panel
npm run start        # Production server

# Frontend
cd frontend
npm run dev          # Vite dev server
npm run build        # Production build
```

## Running Sync

**Via Admin**: Admin Panel → Supplier Sync → Click supplier → "Sync"

**Via API**:
```bash
curl -X POST http://localhost:1337/api/promidata-sync/start \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Force full re-sync**:
```sql
UPDATE products SET promidata_hash = NULL;
```

## Database Access

```bash
PGPASSWORD="password" psql -h 46.62.239.73 -U postgres -d postgres
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ECONNRESET` on DB | Set `ssl: { rejectUnauthorized: false }` in `database.ts` |
| `ECONNREFUSED` | Check DATABASE_URL and server connectivity |
| R2 `Access Denied` | Verify R2_ACCESS_KEY_ID/SECRET |
| Admin won't load | Run `npm run build` first |
| Port in use | `lsof -ti:PORT \| xargs kill -9` |
| npm install fails | `rm -rf node_modules package-lock.json && npm install` |
| API 404 in frontend | Ensure backend is running on 1337 |
| Empty products | Check Strapi permissions (Public role) |

## First Time Setup

1. Start backend: `npm run develop`
2. Visit http://localhost:1337/admin
3. Create admin account
4. Suppliers auto-bootstrap on first run (56 total)
5. Run first sync via admin panel

## Deployment

**Backend** (Coolify/Docker):
```bash
npm run build && npm run start
# Set NODE_ENV=production and production env vars
```

**Frontend** (Vercel):
```bash
npm run build  # Output: dist/
vercel --prod
```

---

*For architecture details see ARCHITECTURE.md. For known issues see GOTCHAS.md.*
