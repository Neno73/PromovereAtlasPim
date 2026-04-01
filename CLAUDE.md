# PromoAtlas PIM System

*Last updated: 2026-01-03*

## System Status ✅

**OPERATIONAL**: Backend (1337), Frontend (3000), PostgreSQL (Coolify), Redis (local:6380), 5 BullMQ workers, Gemini RAG

## Quick Context

Strapi 5-based PIM for promotional products. Key features:
- **56 Promidata suppliers** with hash-based incremental sync (89% efficiency)
- **Product → ProductVariant** hierarchy for size/color variants
- **Gemini FileSearchStore** for semantic search
- **Meilisearch** for exact search
- **Cloudflare R2** for images

## Essential Commands

```bash
# Backend
cd backend && npm run develop   # Start dev server
cd backend && npm run build     # Build admin panel

# Frontend
cd frontend && npm run dev      # Start Vite dev server

# Local Redis (dev)
docker start promoatlas-redis   # Or: docker run -d --name promoatlas-redis -p 6380:6379 redis:alpine
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
- **Context7 MCP** - Documentation lookup
- **Playwright MCP** - Browser automation

---

*Run `/thoughtful-dev:audit-docs` to check documentation drift.*
