# PromoAtlas Documentation Index

*Last updated: 2025-11-16*

Streamlined documentation for PromoAtlas PIM. **Context-optimized**: 53% reduction from 7,326 to 3,411 lines.

**System Status**: ✅ Fully operational - All queue workers running, Meilisearch sync fixed

## Active Documentation

### Core Files (Read as needed)

**STACK.md** (234 lines) - Tech stack with versions and rationale
- Read when: Adding dependencies, upgrading packages, understanding technology choices
- Contains: Strapi 5.17.0, React 18, Vite, PostgreSQL (Neon), R2, BullMQ

**ARCHITECTURE.md** (887 lines) - System design and component structure
- Read when: Implementing features, refactoring, understanding data flow
- Contains: Product/Variant hierarchy, Queue system (4 workers), Service layer, API routes

**PATTERNS.md** (775 lines) - Code conventions used in THIS project
- Read when: Writing new code, enforcing consistency
- Contains: TypeScript patterns, service conventions, component patterns, CSS modules

**STARTUP.md** (746 lines) - Setup guide and troubleshooting
- Read when: Dev environment setup, debugging startup, deploying
- Contains: Environment setup, commands, port config, troubleshooting

**GOTCHAS.md** (323 lines) ✨ Trimmed - Known issues (fixed issues removed)
- Read when: Encountering bugs, performance issues, edge cases
- Contains: Hash sync limitations, timeouts, security considerations, monitoring gaps

**DECISIONS.md** (357 lines) ✨ Consolidated - Architectural decision history
- Read when: Understanding design rationale, planning major changes
- Contains: Recent decisions (2025), foundational tech choices summarized

## Archived Documentation

**Location**: `.claude/archive/` (removed from Claude's context to reduce bloat)

- **DEPLOYMENT.md** - Coolify deployment guide (266 lines)
- **DOMAIN-SETUP.md** - Domain configuration (339 lines)
- **IMPROVEMENTS.md** - Future improvements list (1,412 lines)
- **QDRANT_IMPLEMENTATION_PLAN.md** - Qdrant plan (746 lines)
- **QUICK_WINS_IMPLEMENTED.md** - Historical quick wins (393 lines)

**Total archived**: 3,156 lines (43% of original docs)

## How to Use

### For Humans
- Start with **INDEX.md** (this file) to understand what documentation exists
- Read **STARTUP.md** first when setting up the project
- Refer to **PATTERNS.md** when writing code to maintain consistency
- Check **GOTCHAS.md** when encountering issues
- Log decisions in **DECISIONS.md** after making architectural changes
- Check **reference/** for detailed step-by-step procedures

### For Claude Code
- **CLAUDE.md** (root) is auto-loaded at the start of every session
- Detailed docs are imported via `@import` when working on specific areas
- Example: "Refactor the API" → Claude reads @.claude/ARCHITECTURE.md
- Example: "Fix sync performance" → Claude reads @.claude/ARCHITECTURE.md (Promidata sync section)
- Example: "Update dependencies" → Claude reads @.claude/STACK.md
- Reference docs available on-demand via explicit mention

## Progressive Disclosure

Detailed documentation is pulled in ONLY when needed to prevent context bloat while maintaining comprehensive knowledge. Updates to these files are automatically available via the `@import` system.

## Living Documentation

- Use `#` prefix in conversation to quickly add new rules (e.g., `# Always validate SKU uniqueness`)
- Edit files directly for larger changes
- Update as architecture and patterns evolve
- Timestamps track when documentation was last updated

---

*Documentation structure created by thoughtful-dev plugin*
