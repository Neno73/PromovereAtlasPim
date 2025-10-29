# Tech Stack

*Last updated: 2025-10-29 19:40*

Complete technology stack for PromoAtlas PIM system with versions and rationale.

## Backend Stack (Strapi 5)

### Core Framework
- **Strapi 5.17.0** - Headless CMS for content management
  - **Why**: Provides robust API, content-type builder, admin panel, plugin ecosystem
  - **Node Requirement**: 18.0.0 - 22.x.x
  - **Key Features**: Content types, components, lifecycle hooks, permissions

### Strapi Plugins
- **@strapi/plugin-users-permissions** (5.17.0) - Authentication & authorization
- **@strapi/plugin-cloud** (5.17.0) - Cloud integrations
- **strapi-provider-cloudflare-r2** (^0.3.0) - Cloudflare R2 storage provider
- **@strapi/provider-upload-aws-s3** (5.18.0) - S3-compatible upload provider

### Database
- **PostgreSQL** via Neon - Primary database
  - **Why**: Robust relational database with JSON field support for multilingual content
  - **Driver**: `pg` (8.16.3)
  - **Connection**: Neon with Cloudflare Hyperdrive for connection pooling
  - **Pool Settings**: min 2, max 10 connections
  - **Fallback**: `better-sqlite3` (11.3.0) for development

### Storage
- **Cloudflare R2** - Object storage for product images
  - **Why**: Cost-effective, no egress fees, S3-compatible API
  - **SDK**: `@aws-sdk/client-s3` (3.844.0)
  - **Features**: Public bucket access, automatic image URL generation

### HTTP Client
- **node-fetch** (2.7.0) - HTTP requests for Promidata API integration
  - **Why**: Simple, Promise-based API for external data fetching

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
  - **Dev Server Port**: 3001
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
- **Neon** - Serverless PostgreSQL
  - **Why**: Serverless scaling, automatic backups, connection pooling
  - **Feature**: Cloudflare Hyperdrive for optimized connections

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
- **No test framework currently configured**
  - Opportunity: Add Jest/Vitest for unit tests
  - Opportunity: Add Playwright for E2E tests (MCP available)

### Docker
- **Docker support available**
  - Multiple Dockerfile variants: `Dockerfile`, `Dockerfile.fixed`
  - Docker Compose configurations for local development

### MCP Tools
- **Neon MCP** - Database operations
- **Strapi MCP** - Content management
- **Playwright MCP** - Browser automation
- **Datadog MCP** - Performance monitoring
- **Sentry MCP** - Error tracking

## Deployment

### Backend Deployment
- **Target**: Production server or containerized environment
- **Build Command**: `npm run build`
- **Start Command**: `npm run start`
- **Environment**: PostgreSQL (Neon), Cloudflare R2

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
| HTTP Client | node-fetch | 2.7.0 | API calls |
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
- Add **Vitest** for unit tests (Vite-native)
- Add **Playwright** for E2E tests (MCP already available)
- Add **React Testing Library** for component tests

### Monitoring
- Integrate **Sentry** for error tracking (MCP available)
- Integrate **Datadog** for performance monitoring (MCP available)

### CI/CD
- Add GitHub Actions for automated testing
- Add Docker builds for consistent deployments
- Add database migration automation

---

*Keep this document updated when adding/removing dependencies or changing infrastructure.*
