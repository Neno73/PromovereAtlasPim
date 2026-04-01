# PromoAtlas PIM System

*Last updated: 2026-04-01*

## System Status ✅

**OPERATIONAL**: Backend (1337), Frontend (3000), PostgreSQL (local:5433), Redis (local:6382), MeiliSearch (local:7700), 4 BullMQ workers

## Quick Context

Strapi 5.41-based PIM for promotional products. Key features:
- **59 Promidata suppliers** with hash-based incremental sync
- **Product → ProductVariant** hierarchy for size/color variants
- **MeiliSearch** for product search (upgrading to hybrid search)
- **Cloudflare R2** for images (migrating to SeaweedFS)
- **Coolify** for deployment (both FE and BE)

## Essential Commands

```bash
# Docker services (postgres, redis, meilisearch)
docker compose up -d

# Backend
cd backend && npm run develop   # Start dev server
cd backend && npm run build     # Build admin panel

# Frontend
cd frontend && npm run dev      # Start Vite dev server
```

**URLs**: Backend http://localhost:1337/admin | Frontend http://localhost:3000

## Core Principles

### MANDATORY

- **Git**: Feature branches only. NEVER push to main/master directly.
- **Database**: Use transactions. ASK before destructive operations.
- **Secrets**: NEVER commit .env files.
- **Backend**: Use `npm run develop` (not `dev`)

### DO NOT

- Skip planning for non-trivial work (use `implementation-planner` skill)
- Work on main/master branch
- Commit secrets

## Documentation

Detailed docs auto-load when needed:

| Doc | Purpose |
|-----|---------|
| @.claude/STACK.md | Tech stack, versions |
| @.claude/ARCHITECTURE.md | System design, content types |
| @.claude/PATTERNS.md | Code conventions |
| @.claude/STARTUP.md | Setup, troubleshooting |
| @.claude/GOTCHAS.md | Known issues |
| @.claude/DECISIONS.md | Architectural decisions |

## MCP Tools

- **Strapi MCP** - Content management
- **MeiliSearch MCP** - Search index operations
- **Context7 MCP** - Documentation lookup
- **Playwright MCP** - Browser automation

---

*Run `/thoughtful-dev:audit-docs` to check documentation drift.*
