# Architectural Decisions

*Last updated: 2025-10-29 19:40*

This log tracks significant architectural decisions made during the development of PromoAtlas PIM.

## Decision Template

When adding a decision, include:
- **Date**: When the decision was made
- **Context**: What problem we're solving
- **Decision**: What we decided to do
- **Consequences**: Trade-offs and implications
- **Status**: Proposed / Accepted / Deprecated / Superseded

---

## [2025-10-29] Product → Product Variant Hierarchy Migration

**Status**: Accepted

**Context**:
The system initially used a flat Product model where each SKU (size/color combination) was a separate product record. This led to:
- Duplicate product information (main images, descriptions, pricing) across size/color variants
- Difficult variant management (no grouping of related products)
- Complex frontend logic to display products with size/color selection
- Inability to easily identify which variants belong to the same product family

**Decision**:
Implemented a two-level hierarchy:
- **Product**: Main product/family (e.g., "Classic T-Shirt") with shared data (pricing, main images, descriptions, brand)
- **Product Variant**: Individual size/color combinations (e.g., "Classic T-Shirt - Black - Large") with variant-specific data

Key design choices:
1. Products grouped by `a_number` (Promidata product family identifier)
2. Product has `variants` relation (one-to-many)
3. Product Variant has flattened dimension fields (not component) for query performance
4. `is_primary_for_color` flag on variants for product listing display
5. Both Product and Variant preserve all PromoAtlas custom fields (hex_color, imprint_position, autorag, etc.)

**Implementation**:
- Created `src/api/product/` (replaces flat model)
- Created `src/api/product-variant/`
- Updated bootstrap permissions for public API access
- Documentation: `backend/docs/HIERARCHY_MIGRATION.md`

**Consequences**:

*Benefits*:
- Reduced data duplication (pricing/images stored once at Product level)
- Better variant management and catalog UI
- Clearer data model matching real-world product families
- Easier to query "show me all variants of this product"
- Frontend can display size/color selectors properly

*Trade-offs*:
- Promidata sync service requires refactoring (group by a_number, create Products + Variants)
- More complex queries (need to populate variants relation)
- Existing frontend code needs updating to query new structure
- TypeScript errors in legacy code until sync service updated

*Migration Path*:
- Sync service updates documented in `backend/docs/HIERARCHY_MIGRATION.md`
- Frontend queries need adjustment (populate variants, use is_primary_for_color)
- Old flat structure backed up in `product-legacy/` (removed from build)

**Related Documentation**:
- Blueprint: `/home/neno/Code/PIM/STRAPI_CONTENT_TYPE_BLUEPRINT.md`
- Migration Guide: `backend/docs/HIERARCHY_MIGRATION.md`
- Updated ARCHITECTURE.md to reflect new schema

---

## [2025-10-29] Thoughtful Dev Documentation Structure Initialized

**Status**: Accepted

**Context**:
PromoAtlas PIM system needed comprehensive documentation for both human developers and Claude Code. The codebase had grown complex with Strapi 5 backend, React frontend, Promidata integration, and AutoRAG sync capabilities. A single CLAUDE.md file was insufficient to document all patterns, architecture, and operational procedures without overwhelming context.

**Decision**:
Implemented Thoughtful Dev plugin's documentation structure:
- **CLAUDE.md** (root) - Lean manifest with essential commands and core principles, auto-loaded every session
- **.claude/** directory - Detailed documentation imported on-demand via `@import` statements
  - INDEX.md - Documentation directory
  - STACK.md - Tech stack with versions and rationale
  - ARCHITECTURE.md - System design and component structure
  - PATTERNS.md - Code conventions specific to this project
  - STARTUP.md - Setup guide and troubleshooting
  - GOTCHAS.md - Known issues and workarounds
  - DECISIONS.md - This file for architectural decision history

**Consequences**:
- **Positive**:
  - Progressive disclosure prevents context pollution
  - Claude Code loads only relevant documentation for current task
  - Human developers have clear navigation via INDEX.md
  - Documentation tracks actual codebase patterns (not generic best practices)
  - Timestamps track when documentation was updated
- **Negative**:
  - Requires discipline to keep documentation updated
  - Multiple files to maintain instead of one
  - Learning curve for new contributors
- **Mitigation**:
  - `doc-maintenance` skill set to "ask" mode to prompt updates
  - `/thoughtful-dev:audit-docs` command for checking drift
  - Clear instructions in INDEX.md on when to read each file

---

## [Pre-2025-10-29] Strapi 5 as Backend Framework

**Status**: Accepted

**Context**:
Needed headless CMS for PIM system with:
- Product catalog management (1000+ products)
- Admin panel for content management
- REST API for frontend integration
- Media storage integration (Cloudflare R2)
- Extensibility for custom sync logic (Promidata integration)

**Decision**:
Chose Strapi 5.17.0 as backend framework.

**Rationale**:
- Out-of-box admin panel (no custom UI needed)
- Content-type builder reduces boilerplate
- Rich plugin ecosystem (R2 storage, users-permissions)
- Lifecycle hooks for custom logic (AutoRAG sync)
- Built-in REST API with filtering, pagination, population
- PostgreSQL support with JSON fields (multilingual content)
- Strong TypeScript support

**Consequences**:
- **Positive**:
  - Rapid development (admin panel, API, permissions out-of-box)
  - Flexible content modeling (products, categories, suppliers)
  - Easy media management with R2 integration
  - Lifecycle hooks enable real-time AutoRAG sync
- **Negative**:
  - Strapi upgrade path sometimes requires migration (4.x → 5.x was significant)
  - Admin panel is large (~15MB)
  - Some Strapi 5 patterns still evolving (`entityService` vs `documents()`)
- **Alternatives Considered**:
  - **Custom Node.js + Express**: More control but significantly more development time
  - **Directus**: Similar CMS but less mature plugin ecosystem
  - **KeystoneJS**: Good alternative but smaller community

---

## [Pre-2025-10-29] React + Vite for Frontend (Not Next.js)

**Status**: Accepted

**Context**:
Needed frontend for displaying product catalog with:
- Product listing with filtering
- Product detail pages
- Image galleries
- Multilingual support
- Responsive design

**Decision**:
Chose React 18 + Vite 5 instead of Next.js.

**Rationale**:
- **Simple SPA requirements**: No SSR needed (public catalog)
- **Faster dev experience**: Vite HMR is faster than Next.js
- **Simpler deployment**: Static build (no Node.js server)
- **Backend already exists**: Strapi handles API, no need for Next.js API routes
- **Lower complexity**: React + Vite is simpler stack for this use case

**Consequences**:
- **Positive**:
  - Very fast dev server startup (<1 second)
  - Simple deployment to Vercel (static files)
  - No server-side concerns (backend = Strapi)
  - Lighter bundle size than Next.js
- **Negative**:
  - No SEO optimization (client-side rendering only)
  - No server-side data fetching (all API calls from browser)
  - If SEO needed later, migration to Next.js required
- **Trade-off Accepted**: SEO not critical for internal PIM tool

---

## [Pre-2025-10-29] CSS Modules (Not Tailwind or styled-components)

**Status**: Accepted

**Context**:
Needed styling solution for frontend components.

**Decision**:
Use CSS Modules with plain CSS (no CSS-in-JS framework).

**Rationale**:
- **Zero runtime overhead**: CSS modules compile to static CSS
- **Familiar syntax**: Plain CSS, no learning curve
- **Scoped styles**: Prevents class name collisions
- **No dependencies**: No additional packages needed
- **Simple debugging**: Standard CSS in DevTools

**Consequences**:
- **Positive**:
  - Fastest runtime performance (no JS for styling)
  - Easy to maintain for developers familiar with CSS
  - Smaller bundle size (no CSS-in-JS library)
  - Works out-of-box with Vite
- **Negative**:
  - More verbose than utility-first (Tailwind)
  - No design system constraints (developers write custom CSS)
  - Responsive design requires media queries (not utility classes)
- **Alternatives Considered**:
  - **Tailwind CSS**: Faster prototyping but larger HTML, utility class learning curve
  - **styled-components**: Better TypeScript integration but runtime overhead
  - **Plain CSS**: No scoping, class name collisions

---

## [Pre-2025-10-29] Hash-Based Incremental Sync

**Status**: Accepted

**Context**:
Promidata API provides product data for 56 suppliers with 1000+ products. Full sync takes hours and hammers the API. Most products don't change between syncs.

**Decision**:
Implement hash-based incremental sync using SHA-1 hashes from Promidata's Import.txt.

**Approach**:
1. Fetch Import.txt with product URLs and SHA-1 hashes
2. Compare hashes against stored `promidata_hash` field
3. Skip products with matching hash (unchanged)
4. Download and process only changed products
5. Track efficiency metrics (skipped vs processed)

**Consequences**:
- **Positive**:
  - 89% efficiency achieved (98/110 products skipped in test)
  - Faster sync times (minutes vs hours)
  - Reduced API load on Promidata
  - Lower bandwidth usage
  - Fewer R2 uploads
- **Negative**:
  - If Promidata changes product but keeps same hash, update is missed (very rare)
  - No timestamp-based fallback
  - Requires periodic full sync to ensure consistency
- **Mitigation**:
  - Run full sync periodically (monthly)
  - SQL command to clear hashes: `UPDATE products SET promidata_hash = NULL;`

---

## [Pre-2025-10-29] Multilingual Data as JSON Fields

**Status**: Accepted

**Context**:
Products have multilingual names, descriptions, colors, materials (NL, DE, EN, FR). Need to store and query translations efficiently.

**Decision**:
Store multilingual fields as JSON in PostgreSQL (not separate translation tables).

**Structure**:
```json
{
  "name": {
    "en": "Product Name",
    "de": "Produktname",
    "fr": "Nom du produit",
    "es": "Nombre del producto"
  }
}
```

**Rationale**:
- **Simpler schema**: No translation tables, no joins
- **Atomic updates**: Update all translations in single query
- **JSON support**: PostgreSQL has excellent JSON operators
- **Strapi support**: JSON fields work natively in Strapi 5

**Consequences**:
- **Positive**:
  - Simpler queries (no joins)
  - Atomic updates (all languages together)
  - Easy to add new languages
  - Strapi content-type builder supports JSON
- **Negative**:
  - Cannot index JSON fields efficiently
  - Full-text search requires extracting text
  - Searching by name requires full table scan
- **Mitigation**:
  - Add generated columns for searchable languages
  - Use PostgreSQL full-text search (`tsvector`)
  - Limit page size to reduce result sets

---

## [Pre-2025-10-29] Cloudflare R2 for Image Storage

**Status**: Accepted

**Context**:
Need object storage for product images (1000+ products, multiple images per product).

**Decision**:
Use Cloudflare R2 instead of AWS S3 or local storage.

**Rationale**:
- **Zero egress fees**: R2 doesn't charge for data transfer (S3 does)
- **S3-compatible API**: Easy migration path, familiar API
- **Global CDN**: Built-in edge caching
- **Cost-effective**: Lower cost than S3 for image-heavy PIM
- **Strapi integration**: R2 provider available (`strapi-provider-cloudflare-r2`)

**Consequences**:
- **Positive**:
  - Significantly lower costs than S3 (no egress fees)
  - Fast global delivery via Cloudflare edge
  - Simple integration with Strapi
  - No vendor lock-in (S3-compatible API)
- **Negative**:
  - Less mature than S3 (newer service)
  - Fewer features than S3 (e.g., lifecycle policies)
  - Cloudflare ecosystem dependency
- **Cost Comparison**:
  - R2: ~$0.015/GB storage, $0 egress
  - S3: ~$0.023/GB storage, ~$0.09/GB egress
  - For 10GB images + 100GB monthly egress: R2 = $0.15, S3 = $9.23

---

## [Pre-2025-10-29] PostgreSQL via Neon (Not Local)

**Status**: Accepted

**Context**:
Need reliable PostgreSQL database for production and development.

**Decision**:
Use Neon serverless PostgreSQL instead of self-hosted or RDS.

**Rationale**:
- **Serverless scaling**: Automatically scales with load
- **Connection pooling**: Built-in pooling via Hyperdrive
- **Instant branches**: Easy to create dev/staging branches
- **Automatic backups**: Point-in-time recovery
- **Developer-friendly**: Great DX, easy setup

**Consequences**:
- **Positive**:
  - No database management overhead
  - Scales automatically with traffic
  - Built-in backups and recovery
  - Connection pooling prevents pool exhaustion
  - Fast provisioning (seconds)
- **Negative**:
  - Vendor lock-in (Neon-specific)
  - Cold start latency (~1s for inactive databases)
  - Less control than self-hosted
  - Cost can increase with scale
- **Alternatives Considered**:
  - **AWS RDS**: More control but more management overhead
  - **Self-hosted**: Full control but high maintenance burden
  - **Supabase**: Good alternative but less PostgreSQL-focused

---

## [Pre-2025-10-29] Real-Time AutoRAG Sync via Lifecycle Hooks

**Status**: Accepted (with caveats)

**Context**:
Need to sync products to AutoRAG vector database for AI-powered search. Options:
1. Manual sync after product changes
2. Batch sync on schedule
3. Real-time sync via lifecycle hooks

**Decision**:
Implement real-time sync using Strapi lifecycle hooks (`afterCreate`, `afterUpdate`, `afterDelete`).

**Consequences**:
- **Positive**:
  - Products immediately available in AutoRAG
  - No manual sync needed
  - Always in sync (no drift)
  - Simple implementation
- **Negative**:
  - Product save blocked if AutoRAG fails
  - No retry mechanism for failures
  - External service dependency in critical path
- **Known Issue**: See GOTCHAS.md "AutoRAG Lifecycle Hook Failures"
- **Recommendation**: Add try-catch and queue failed syncs for retry

---

## Future Decisions to Document

As the project evolves, document decisions on:
- Adding test framework (Vitest vs Jest)
- Adding E2E testing (Playwright implementation)
- Implementing caching strategy (Redis?)
- Adding full-text search (PostgreSQL tsvector vs Elasticsearch)
- Internationalization (i18n framework)
- Authentication for frontend (if needed)
- Monitoring and logging (Sentry, Datadog)

---

*Log all significant architectural decisions here to maintain institutional knowledge.*
