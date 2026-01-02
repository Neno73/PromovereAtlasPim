# PromoAtlas PIM - Tech Stack

*Last updated: 2025-11-19 19:46*

## Backend

### Core Framework
- **Strapi 5.17.0** - Headless CMS framework
  - Why: Built-in admin panel, content types, plugins ecosystem
  - Why v5: Latest stable, better TypeScript support, improved performance

### Database
- **PostgreSQL 14+** (via Neon)
  - Why: Robust relational DB, JSON support for multilingual fields
  - Why Neon: Serverless, auto-scaling, generous free tier

### Queue System
- **BullMQ 5.0.0** - Job queue
  - Why: Reliable async processing, retries, progress tracking
- **ioredis 5.3.0** - Redis client
  - Why: Required for BullMQ, also used for caching

### Storage
- **Cloudflare R2** (S3-compatible)
  - Why: Zero egress fees, fast CDN, affordable
  - Via: `strapi-provider-cloudflare-r2` plugin

### Search & RAG
- **Meilisearch 0.54.0**
  - Why: Fast typo-tolerant search, faceted search, real-time indexing
  - Use case: Exact product search, filters, facets

- **Google Gemini File Search API** ⭐ NEW (2025-11-19)
  - Why: Semantic search, RAG capabilities, persistent embeddings
  - Use case: AI-powered product discovery, natural language queries
  - Package: `@google/genai 1.30.0`

### External APIs
- **Promidata API** - Product data source
  - Format: Import.txt (TSV), CAT.csv (categories), XML product details

## Frontend

### Framework
- **React 18.0.0**
  - Why: Component-based, large ecosystem, TypeScript support

### Build Tool
- **Vite** - Fast build tool
  - Why: Lightning-fast HMR, optimized builds, better DX than CRA

### Styling
- **CSS Modules**
  - Why: Scoped styles, no runtime overhead, simple to maintain

### Routing
- **React Router DOM 6.0.0**
  - Why: Standard React routing, declarative, nested routes

## DevOps

### Version Control
- **Git** with feature branch workflow
  - Branches: `feature/*`, `fix/*`, `refactor/*`
  - Never push directly to main
  - Always create PRs

### Environment Variables
```env
# Database
DATABASE_URL=postgresql://...
DATABASE_CLIENT=postgres

# Storage
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=...
R2_PUBLIC_URL=...

# Queue
REDIS_URL=redis://...

# Search
MEILISEARCH_HOST=...
MEILISEARCH_ADMIN_KEY=...

# RAG (NEW)
GEMINI_API_KEY=AIzaSy...
```

## Architecture Decisions

### Why Headless RAG?
- **Gemini**: Semantic understanding ("blue t-shirts")
- **Meilisearch**: Exact search, filters, facets
- **Strapi**: Source of truth, admin, write operations
- **Frontend (separate repo)**: Orchestrates all three via tool calling

### Why Separate Frontend Repo (Future)?
- Multi-brand portability
- Independent deployment
- Different tech stack possible (Next.js, Remix, etc.)
- Clean separation of concerns

### Why Not [Alternative]?

#### Why not MongoDB?
- No native JSON query support like PostgreSQL
- Strapi works better with SQL databases
- Relational data fits our product hierarchy

#### Why not ElasticSearch?
- Meilisearch simpler to set up and maintain
- Better out-of-box experience for product search
- Lower resource requirements

#### Why not OpenAI/Anthropic for RAG?
- Gemini has built-in FileSearchStore (persistent)
- Google's File Search API purpose-built for RAG
- Competitive pricing
- Integrated embeddings + generation

#### Why not replace Meilisearch with Gemini?
- Gemini optimized for semantic, not exact match
- Meilisearch better for faceted search, filters
- Cost considerations (Gemini per-query pricing)
- Use both for different purposes

## Dependencies

### Backend Core
```json
{
  "@strapi/strapi": "5.17.0",
  "@strapi/plugin-users-permissions": "5.17.0",
  "pg": "^8.16.3",
  "bullmq": "^5.0.0",
  "ioredis": "^5.3.0"
}
```

### Backend Plugins
```json
{
  "strapi-plugin-meilisearch": "^0.13.4",
  "strapi-provider-cloudflare-r2": "^0.3.0",
  "@google/genai": "^1.30.0"
}
```

### Frontend
```json
{
  "react": "^18.0.0",
  "react-dom": "^18.0.0",
  "react-router-dom": "^6.0.0",
  "typescript": "^5"
}
```

## Version History

### 2025-11-19: Gemini RAG Integration ⭐
- Added `@google/genai 1.30.0`
- Implemented FileSearchStore integration
- Auto-sync to Gemini on product updates

### 2025-11-04: Hash-based Sync Optimization
- Improved sync efficiency to 89%
- Added batch hash checking

### 2025-10-29: Product Variant Architecture
- Switched to Product → ProductVariant hierarchy
- Reduced data duplication

---

*This stack is optimized for:*
- Developer experience
- Cost efficiency  
- Scalability
- Maintainability
