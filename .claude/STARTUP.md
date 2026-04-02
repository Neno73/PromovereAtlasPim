# Startup Guide

*Last updated: 2026-04-01*

Quick setup and operations for PromoAtlas PIM.

## Prerequisites

- Node.js 18-22
- Docker + Docker Compose (for local services)
- Git

## Quick Start

### 1. Start Docker services

```bash
docker compose up -d
# Starts: PostgreSQL (5433), Redis (6382), MeiliSearch (7700)
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env  # Edit with your credentials
npm run build         # First time only
npm run develop       # Start with hot-reload
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev           # Starts on port 3000+
```

## Service URLs

| Service | URL |
|---------|-----|
| Backend | http://localhost:1337 |
| Admin Panel | http://localhost:1337/admin |
| API | http://localhost:1337/api |
| Frontend | http://localhost:3000 |
| Queue Dashboard | http://localhost:1337/admin/queue-dashboard |
| MeiliSearch | http://localhost:7700 |

## Docker Services

| Service | Container | Port | Credentials |
|---------|-----------|------|-------------|
| PostgreSQL 17 | promoatlas-postgres | localhost:5433 | strapi / strapi123 / db: promoatlas |
| Redis 7 | promoatlas-redis | localhost:6382 | no auth |
| MeiliSearch | promoatlas-meilisearch | localhost:7700 | key: promoatlas-dev-key |

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

# Docker
docker compose up -d     # Start all services
docker compose down      # Stop all services
docker compose logs -f   # View logs
```

## Running Sync

**Via Admin**: Admin Panel → Supplier Sync → Click supplier → "Sync"

**Via API**:
```bash
curl -X POST http://localhost:1337/api/promidata-sync/start \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Force full re-sync** (bypasses hash check):
```sql
UPDATE products SET promidata_hash = NULL;
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ECONNRESET` on DB | Set `ssl: { rejectUnauthorized: false }` in `database.ts` |
| `ECONNREFUSED` | Check Docker services: `docker compose ps` |
| Admin won't load | Run `npm run build` first |
| Port in use | `lsof -ti:PORT \| xargs kill -9` |
| npm install fails | `rm -rf node_modules package-lock.json && npm install` |
| Empty products | Check Strapi permissions (Public role) |
| Empty price tiers | Run full re-sync after schema changes |

## First Time Setup

1. `docker compose up -d` — Start PostgreSQL, Redis, MeiliSearch
2. `cd backend && npm install && npm run build && npm run develop`
3. Visit http://localhost:1337/admin — Create admin account
4. Suppliers auto-bootstrap on first run (59 total)
5. Run first sync via admin panel

## Deployment (Coolify)

Both backend and frontend deploy via Coolify using `docker-compose.coolify.yml`:
- Push to `develop` → Staging deploy
- Push to `main` → Production deploy

---

*For architecture details see ARCHITECTURE.md. For known issues see GOTCHAS.md.*
