# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PromoAtlas is a Strapi 5-based Product Information Management (PIM) system designed for managing promotional products from Promidata suppliers. The system consists of a backend API (Strapi 5) and a React frontend with automated product synchronization capabilities.

## Development Commands

### Backend (Strapi 5)
```bash
cd backend
npm run develop      # Start development server with auto-reload
npm run build       # Build for production
npm run start       # Start production server
npm run console     # Open Strapi console
npm run deploy      # Deploy to configured environment
```

### Frontend (React)
```bash
cd frontend
npm run dev         # Start Vite development server
npm run build       # Build for production (TypeScript + Vite)
npm run lint        # Run ESLint with TypeScript rules
npm run preview     # Preview production build
```

### Important Notes
- Always work in the correct directory (`backend/` or `frontend/`)
- The backend runs on port 1337, frontend on Vite's default port
- Use `npm run develop` (not `dev`) for Strapi backend development

## Architecture Overview

### Backend Structure (Strapi 5)
- **Content Types**: Product, Supplier, Category, Sync Configuration, Promidata Sync
- **Components**: Product dimensions, price tiers (8-tier pricing structure)
- **Core Service**: Promidata sync with hash-based incremental updates
- **Database**: PostgreSQL via Neon with Cloudflare Hyperdrive
- **Storage**: Cloudflare R2 for product images
- **Authentication**: JWT-based admin access

### Key Backend Patterns
- Content types in `src/api/[type-name]/` with controllers, services, routes
- Promidata sync service handles API integration and product transformation
- Hash-based sync prevents duplicate imports
- Multilingual product data (NL/DE/EN) stored as JSON fields
- Image processing with automatic upload to R2

### Frontend Structure (React + TypeScript)
- **Components**: ProductCard, FilterBar for catalog display
- **Pages**: ProductList, ProductDetail for user interface
- **Services**: API client for Strapi backend integration
- **Styling**: CSS modules with responsive design
- **Strapi 5 Compatibility**: Updated to use documentId routing and removed .attributes wrapper

### Database Schema
```
products               # Main product catalog
suppliers (56 records) # Promidata suppliers A23-A618
categories             # Product categorization
sync_configurations    # Sync tracking and status
promidata_syncs        # Sync operation logs
```

## Promidata Integration

### Sync Process
1. **Hash Comparison**: Check product-level hashes from Import.txt for incremental sync
2. **Product Processing**: Download and transform JSON product data only for changed products
3. **Image Handling**: Upload product images to Cloudflare R2 storage
4. **Category Import**: Process CAT.csv for product categorization
5. **Incremental Updates**: Skip unchanged products based on hash comparison (89% efficiency achieved)

### Key Integration Points
- Main sync service: `backend/src/api/promidata-sync/services/promidata-sync.ts`
- Product transformation logic handles multilingual data (NL/DE/EN/FR)
- Supplier management with enable/disable functionality via admin dashboard
- Manual and automatic sync capabilities with real-time progress tracking
- Hash-based incremental sync prevents duplicate processing and improves performance

### Sync Efficiency
- **Incremental Sync**: Only processes products with changed hashes
- **Skip Tracking**: Reports number of skipped vs processed products
- **Efficiency Metrics**: Displays percentage of unchanged products skipped
- **Performance**: Tested with A360 supplier (89% efficiency - 98/110 products skipped)

## Environment Configuration

### Required Backend Environment Variables
```env
DATABASE_URL=postgresql://...     # Neon PostgreSQL connection
R2_ACCESS_KEY_ID=...             # Cloudflare R2 credentials
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=promo-atlas-images
R2_PUBLIC_URL=...
R2_ENDPOINT=...
APP_KEYS=...                     # Strapi security keys
ADMIN_JWT_SECRET=...
API_TOKEN_SALT=...
```

### Testing and Development
- Backend includes test scripts for Promidata sync and R2 connectivity
- Use `node scripts/test-promidata-sync.js` to test API integration
- Supplier data is bootstrapped automatically on first run

## Common Development Tasks

### Adding New Content Types
1. Use Strapi's content-type builder or create manually in `src/api/`
2. Follow existing patterns for controllers, services, and routes
3. Update TypeScript definitions in `types/generated/`

### Modifying Promidata Sync
- Main logic in `promidata-sync.ts` service
- Product transformation in `createOrUpdateProduct` method
- Hash comparison logic in `syncSupplier` method

### Frontend Development
- API client in `frontend/src/services/api.ts`
- Components follow CSS module pattern
- TypeScript interfaces in `frontend/src/types/`

### Database Operations
- Use Strapi's entityService for CRUD operations
- Neon MCP available for direct database management
- Migration files in `backend/database/migrations/`

## Production Considerations

### Performance
- Hash-based sync prevents unnecessary API calls
- Image optimization through R2 CDN
- Database indexing on SKU and supplier fields
- Pagination for large product catalogs

### Security
- JWT authentication for admin access
- API token protection for external access
- Environment variable management for credentials
- R2 bucket permissions configured for public read

### Monitoring
- Strapi logging for sync operations
- Error tracking in sync process
- Performance metrics for large imports
- Database connection pooling via Hyperdrive

## MCP Tools and Memory Management

### Available MCP Tools
You have access to multiple MCP (Model Control Protocol) servers that provide specialized capabilities:

#### Neon Database MCP
- **Primary Database**: Use for all database operations (queries, migrations, schema changes)
- **Key Commands**: `mcp__neon__run_sql`, `mcp__neon__describe_table_schema`, `mcp__neon__get_database_tables`
- **Migration Tools**: `mcp__neon__prepare_database_migration`, `mcp__neon__complete_database_migration`
- **Authentication**: `mcp__neon__provision_neon_auth` for Stack Auth integration

#### Cloudflare MCP Tools
- **Workers Observability**: Monitor and debug Cloudflare Workers if used
- **R2 Storage**: Additional R2 management capabilities
- **AI Gateway**: For AI/ML integrations

#### Sentry Error Monitoring
- **Error Tracking**: Comprehensive error monitoring and alerting
- **Platform Guides**: Documentation for Node.js, React, and other frameworks
- **Performance Monitoring**: Track application performance metrics

#### Docker MCP
- **Container Management**: Full Docker container lifecycle management
- **Development Environment**: Consistent development environments

#### Strapi MCP
- **CMS Management**: Direct Strapi API interactions
- **Content Operations**: Advanced content management capabilities

#### Datadog MCP
- **Performance Monitoring**: Real-time application metrics and dashboards
- **Log Analytics**: Advanced log aggregation and analysis
- **Alert Management**: Monitor system health and performance bottlenecks
- **Key Commands**: `mcp__datadog__get-monitors`, `mcp__datadog__search-logs`, `mcp__datadog__aggregate-logs`

#### Playwright MCP (Browser Automation)
- **Full Web Operations**: Complete browser automation and testing
- **Frontend Testing**: Automated UI testing and validation
- **Screenshot Capture**: Visual documentation and debugging
- **Navigation**: `mcp__playwright-mcp__browser_navigate`, `mcp__playwright-mcp__browser_click`
- **Interaction**: `mcp__playwright-mcp__browser_type`, `mcp__playwright-mcp__browser_snapshot`
- **Testing**: `mcp__playwright-mcp__browser_take_screenshot`, `mcp__playwright-mcp__browser_wait`

### Memory Management (Graphiti)

#### Strategic Memory Usage
- **Add Project Context**: Use `mcp__graphitymemory__add_memory` to store important project decisions, architecture changes, and sync configurations
- **Search Memory**: Use `mcp__graphitymemory__search_memory_nodes` and `mcp__graphitymemory__search_memory_facts` before starting tasks to recall previous work
- **Track Supplier Changes**: Store supplier-specific sync issues and solutions
- **Document Product Transformations**: Save complex data transformation logic for future reference

#### Memory Best Practices
```javascript
// Store important project updates
await addMemory({
  name: "Promidata Sync Enhancement",
  episode_body: "Enhanced product sync to handle new image format XYZ, improved error handling for timeout issues",
  group_id: "promoatlas",
  source: "text"
});

// Search before making changes
const relatedFacts = await searchMemoryFacts("promidata sync image upload");
```

### Tool Usage Guidelines

#### Proactive Tool Usage
- **Always check memory** before starting any significant task
- **Use Neon MCP** for all database operations instead of manual SQL
- **Monitor with Sentry** when implementing error-prone operations
- **Document decisions** in memory for future reference

#### Sequential Thinking with Tools
1. **Research Phase**: Search memory and documentation
2. **Planning Phase**: Use TodoWrite to track complex tasks
3. **Implementation Phase**: Use appropriate MCP tools
4. **Documentation Phase**: Add learnings to memory

#### Tool Mastery Principles
- Prefer MCP tools over manual operations
- Use multiple tools in parallel when possible
- Document tool usage patterns in memory
- Share successful tool combinations with future instances

#### Advanced Development Workflows
- **Frontend Testing**: Use Playwright MCP for automated UI testing and validation
- **Performance Monitoring**: Leverage Datadog MCP for real-time metrics during development
- **Full-Stack Debugging**: Combine Sentry error tracking with Datadog performance monitoring
- **Visual Documentation**: Use Playwright screenshots for bug reports and feature documentation
- **Database + Browser**: Parallel Neon database operations with Playwright frontend testing