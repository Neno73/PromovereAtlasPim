# PromoAtlas Documentation Index

*Last updated: 2025-11-02 20:40*

This directory contains detailed documentation for the PromoAtlas PIM system. All files are auto-loaded by Claude Code via `@import` statements when relevant to the current task.

**System Status**: ✅ Fully operational as of 2025-11-02 20:40

## Documentation Files

### Core Documentation

**STACK.md** - Tech stack with versions and rationale
- Read when: Adding dependencies, upgrading packages, onboarding new developers
- Contains: Strapi 5.17.0, React 18, Vite 5, PostgreSQL (Neon), Cloudflare R2, TypeScript 5.2.2

**ARCHITECTURE.md** - System design and component structure
- Read when: Implementing new features, refactoring code, understanding data flow
- Contains: Content types, service layer, frontend components, Promidata sync architecture

**PATTERNS.md** - Code conventions used in THIS project
- Read when: Writing new code, reviewing PRs, enforcing consistency
- Contains: File naming, TypeScript patterns, service layer structure, CSS modules, API client design

**STARTUP.md** - Setup guide and troubleshooting
- Read when: Setting up dev environment, debugging startup issues, deploying
- Contains: Environment variables, database setup, service URLs, common issues

**GOTCHAS.md** - Known issues and workarounds
- Read when: Encountering unexpected behavior, implementing image handling, working with sync
- Contains: Image fitting edge cases, multilingual text handling, pagination limits, Strapi 5 migration patterns

**DECISIONS.md** - Architectural decision history
- Read when: Understanding why things are designed a certain way, making new architectural decisions
- Contains: Log of significant decisions with context, trade-offs, and consequences

**DEPLOYMENT.md** - Coolify deployment guide with CI/CD automation
- Read when: Setting up staging/production deployment, configuring environment variables, troubleshooting deployments
- Contains: Coolify setup, Docker Compose configuration, worker management, monitoring, common deployment issues

**DOMAIN-SETUP.md** - Custom domain configuration for Cloudflare + Coolify
- Read when: Configuring custom domains, setting up DNS, troubleshooting SSL certificates
- Contains: DNS configuration, domain routing, Let's Encrypt SSL setup, CORS configuration

**IMPROVEMENTS.md** - Comprehensive improvement roadmap
- Read when: Planning enhancements, prioritizing work, understanding technical debt
- Contains: Detailed improvement suggestions for sync plugin and system, with code examples and implementation roadmap

**QUICK_WINS_IMPLEMENTED.md** - Recently implemented improvements (2025-10-29)
- Read when: Testing new improvements, understanding what changed, troubleshooting new features
- Contains: Retry mechanism, batch hash checking, health check endpoints - full implementation guide with testing instructions

## Reference Documentation

**reference/** - Supplementary detailed guides
- **README_AUTORAG.md** - AutoRAG setup and troubleshooting
- **NEON_BACKUP_STRATEGY.md** - Database backup and branch management
- **SECURITY_BEST_PRACTICES.md** - Security guidelines and secret management

These are preserved from the previous documentation structure and provide detailed procedures for specific topics.

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
