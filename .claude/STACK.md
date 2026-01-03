# Tech Stack

*Last updated: 2025-12-05 14:50*

Complete technology stack for PromoAtlas PIM system with versions and rationale.

**Status**: All services operational and dependencies verified working.

## Backend Stack (Strapi 5)

### Core Framework
- **Strapi 5.17.0** - Headless CMS for content management
  - **Why**: Provides robust API, content-type builder, admin panel, plugin ecosystem
  - **Node Requirement**: 18.0.0 - 22.x.x
  - **Key Features**: Content types, components, lifecycle hooks, permissions

### Strapi Plugins
- **@strapi/plugin-users-permissions** (5.17.0) - Authentication & authorization
- **@strapi/plugin-cloud** (5.17.0) - Cloud integrations
- **@strapi/plugin-documentation** - OpenAPI/Swagger API documentation
- **strapi-provider-cloudflare-r2** (^0.3.0) - Cloudflare R2 storage provider
- **@strapi/provider-upload-aws-s3** (5.18.0) - S3-compatible upload provider
- **strapi-plugin-meilisearch** - Meilisearch integration for product search

### Database
- **PostgreSQL** via Coolify - Primary database
  - **Why**: Robust relational database with JSON field support for multilingual content
  - **Driver**: `pg` (8.16.3)
  - **Connection**: Coolify-managed PostgreSQL (46.62.239.73:5432)
  - **Pool Settings**: min 2, max 10 connections
  - **Fallback**: `better-sqlite3` (11.3.0) for development

### Storage
- **Cloudflare R2** - Object storage for product images
  - **Why**: Cost-effective, no egress fees, S3-compatible API
  - **SDK**: `@aws-sdk/client-s3` (3.844.0)
  - **Features**: Public bucket access, automatic image URL generation

### Search Engine
- **Meilisearch** (^0.54.0) - Full-text search engine
  - **Why**: Fast, typo-tolerant search with faceting and filtering
  - **Host**: External Meilisearch instance (search.sols.mk)
  - **Index**: `pim_products` - Flattened product documents
  - **Features**: Faceted search, typo tolerance, instant results
  - **Integration**: strapi-plugin-meilisearch for automatic indexing

### AI/RAG Integration
- **@google/genai** (^1.30.0) - Google Gemini AI SDK
  - **Why**: Semantic search and AI-powered product discovery
  - **Feature**: FileSearchStore for RAG (Retrieval Augmented Generation)
  - **Store**: `promoatlas-product-catalog-xfex8hxfyifx`
  - **Data Flow**: Strapi → Meilisearch → Gemini FileSearchStore
  - **Tracking**: `gemini_file_uri` field on Product tracks sync status

### HTTP Client
- **node-fetch** (2.7.0) - HTTP requests for Promidata API integration
  - **Why**: Simple, Promise-based API for external data fetching
- **axios** + **axios-retry** - HTTP client with automatic retries
  - **Why**: Robust HTTP calls with exponential backoff for external APIs

### Queue System
- **BullMQ** (^5.0.0) - Redis-based job queue for background processing
  - **Why**: Handles long-running sync operations, concurrent job processing, job retries
  - **Redis Client**: ioredis (^5.3.0)
  - **Redis Provider**: Local Docker (dev) / Coolify Redis (prod)
  - **Workers**: 5 active workers for parallel processing
    - `supplier-sync` (concurrency: 1) - Processes supplier sync jobs sequentially
    - `product-family` (concurrency: 3) - Creates product families with parallelism
    - `image-upload` (concurrency: 10) - High-concurrency image uploads to R2
    - `meilisearch-sync` (concurrency: 5) - Syncs products to Meilisearch index
    - `gemini-sync` (concurrency: 5) - Syncs products to Gemini FileSearchStore
  - **Features**: Job retries, progress tracking, failure handling, queue monitoring
  - **Configuration**: Lazy Redis connection to prevent startup issues
- **@bull-board/api** + **@bull-board/koa** - Queue monitoring dashboard
  - **Why**: Visual queue management, job inspection, retry failed jobs
  - **Access**: Strapi Admin → Queue Dashboard

### Build Tools
- **TypeScript** (5.7.3) - Type safety
- **Vite** (^6.1.12) - Fast build tool and dev server
- **@strapi/sdk-plugin** (5.17.0) - Plugin development SDK

## Frontend Stack (React + TypeScript)

### Core Framework
- **React** (18.2.0) - UI library
  - **Why**: Component-based architecture, large ecosystem, TypeScript support
  - **React DOM**: 18.2.0
  - **React Router DOM**: 6.26.0 - Client-side routing

### Build Tool
- **Vite** (5.0.8) - Build tool and dev server
  - **Why**: Fast HMR, optimized production builds, TypeScript support out-of-box
  - **Dev Server Port**: 3000 (auto-increments to 3001, 3002, etc. if port is occupied)
  - **Proxy**: `/api/*` → `http://localhost:1337` for backend API

### Language
- **TypeScript** (5.2.2) - Static typing
  - **Why**: Prevents runtime errors, better IDE support, self-documenting code
  - **Mode**: Strict mode enabled
  - **Target**: ES2020
  - **Module**: ESNext

### Styling
- **CSS Modules** - Component-scoped styling
  - **Why**: No CSS-in-JS overhead, scoped styles prevent collisions, simple
  - **Pattern**: `Component.tsx` + `Component.css`
  - **Naming**: BEM-like (`.filter-bar`, `.filter-section`)

### Linting & Code Quality
- **ESLint** (8.55.0) - Code linting
  - **Plugins**: `@typescript-eslint/parser`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
  - **Why**: Enforce code quality, catch common mistakes

## Infrastructure & External Services

### Database Hosting
- **Coolify PostgreSQL** - Self-hosted PostgreSQL
  - **Server**: 46.62.239.73:5432
  - **Why**: Full control, no vendor lock-in, cost-effective
  - **Backups**: Managed via Coolify

### Storage Hosting
- **Cloudflare R2** - Object storage
  - **Bucket**: `promo-atlas-images`
  - **Access**: Public read for product images
  - **Why**: Zero egress fees, global CDN, S3-compatible

### External API
- **Promidata API** - Product data source
  - **Base URL**: `https://promi-dl.de/Profiles/Live/849c892e-b443-4f49-be3a-61a351cbdd23`
  - **Alternative**: S3 bucket at `promidatabase.s3.eu-central-1.amazonaws.com`
  - **Format**: JSON product data, CSV categories
  - **Sync Method**: Hash-based incremental updates (SHA-1)

## Development Tools

### Package Managers
- **npm** - Primary package manager
  - Backend: `package-lock.json` present
  - Frontend: `package-lock.json` present

### Testing
- **Jest** (^30.2.0) - Testing framework for backend
  - **Why**: Industry standard, good TypeScript support via ts-jest
  - **Config**: `jest.config.js` in backend root
  - **Commands**: `npm run test`, `npm run test:watch`, `npm run test:coverage`
  - **Coverage**: Worker tests in `src/services/queue/workers/__tests__/`
- **Playwright MCP** - E2E browser testing (available via MCP)

### Docker
- **Docker support available**
  - Multiple Dockerfile variants: `Dockerfile`, `Dockerfile.fixed`
  - Docker Compose configurations for local development

### MCP Tools
- **Strapi MCP** - Content management
- **Playwright MCP** - Browser automation
- **Context7 MCP** - Documentation lookup
- **Datadog MCP** - Performance monitoring
- **Sentry MCP** - Error tracking

## Deployment

### Backend Deployment
- **Target**: Coolify-managed server or containerized environment
- **Build Command**: `npm run build`
- **Start Command**: `npm run start`
- **Environment**: Coolify PostgreSQL, Coolify Redis, Cloudflare R2

### Frontend Deployment
- **Target**: Vercel (configured via `vercel.json` for SPA routing)
- **Build Command**: `npm run build`
- **Output**: `dist/` directory
- **SPA Routing**: All routes rewrite to `index.html` for React Router

## Version Summary Table

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Backend Framework | Strapi | 5.17.0 | Headless CMS & API |
| Frontend Framework | React | 18.2.0 | UI library |
| Language | TypeScript | 5.2.2 (FE), 5.7.3 (BE) | Type safety |
| Build Tool (FE) | Vite | 5.0.8 | Fast dev & build |
| Database | PostgreSQL | - | Data storage |
| DB Driver | pg | 8.16.3 | Database connection |
| Storage | Cloudflare R2 | - | Image hosting |
| AWS SDK | @aws-sdk/client-s3 | 3.844.0 | R2 integration |
| Search Engine | Meilisearch | 0.54.0 | Full-text search |
| AI/RAG | @google/genai | 1.30.0 | Gemini FileSearchStore |
| HTTP Client | node-fetch | 2.7.0 | API calls |
| HTTP Client | axios | - | Retry-enabled API calls |
| Queue System | BullMQ | 5.0.0 | Background jobs |
| Queue UI | @bull-board/* | - | Queue monitoring |
| Redis Client | ioredis | 5.3.0 | Queue backend |
| Testing | Jest | 30.2.0 | Unit tests |
| Routing | React Router DOM | 6.26.0 | Client routing |
| Node Runtime | Node.js | 18-22 | Server runtime |

## Key Technology Decisions

### Why Strapi 5?
- Provides admin panel out-of-box
- Content-type builder reduces boilerplate
- Plugin ecosystem (R2 storage, permissions)
- Lifecycle hooks for custom logic (AutoRAG sync)
- Built-in REST API with filtering, pagination, population

### Why React + Vite (not Next.js)?
- Simple SPA requirements (no SSR needed)
- Vite provides faster dev experience
- Simpler deployment (static build)
- Backend already handles API (Strapi)

### Why CSS Modules (not Tailwind/styled-components)?
- Zero runtime overhead
- Simple scoped styles
- No additional dependencies
- Familiar CSS syntax
- Easy to maintain

### Why PostgreSQL (not MongoDB)?
- Relational data (products, suppliers, categories)
- JSON field support for multilingual content
- ACID transactions for data integrity
- Better for structured data with relationships

### Why Cloudflare R2 (not S3)?
- Zero egress fees (S3 charges for data transfer)
- S3-compatible API (easy migration)
- Global CDN included
- Cost-effective for image-heavy PIM

### Why Meilisearch (not Elasticsearch)?
- Simpler setup and maintenance
- Fast typo-tolerant search out-of-box
- Lower resource requirements
- Strapi plugin for automatic indexing
- Free hosted tier available

### Why Gemini FileSearchStore (for RAG)?
- Native RAG support with semantic embeddings
- Persistent store (files survive API calls)
- Integrated with Gemini models
- Good for product catalog semantic search
- Enables AI-powered product discovery

## Dependencies to Watch

### Security Updates
- **@aws-sdk/client-s3**: AWS SDK updates frequently
- **pg**: Database driver security patches
- **node-fetch**: Known vulnerabilities in older versions (using 2.7.0)

### Breaking Changes
- **Strapi**: Major version upgrades (5.x → 6.x) may require migration
- **React**: 18.x is stable, 19.x on horizon
- **Vite**: 5.x → 6.x may have config changes
- **TypeScript**: Strict mode may break with major updates

### Deprecated
- **node-fetch**: Native `fetch()` now available in Node 18+, consider migration

## Future Considerations

### Testing
- ✅ **Jest** added for backend unit tests (2025-12)
- Add **Playwright** for E2E tests (MCP already available)
- Add **React Testing Library** for frontend component tests
- Add **Vitest** for frontend unit tests (Vite-native)

### Monitoring
- Integrate **Sentry** for error tracking (MCP available)
- Integrate **Datadog** for performance monitoring (MCP available)

### CI/CD
- Add GitHub Actions for automated testing
- Add Docker builds for consistent deployments
- Add database migration automation

---

*Keep this document updated when adding/removing dependencies or changing infrastructure.*
