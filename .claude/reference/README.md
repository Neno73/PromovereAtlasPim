# Reference Documentation

*Last updated: 2025-10-29 19:55*

This directory contains supplementary reference documentation that provides detailed guidance on specific topics.

## Files in This Directory

### README_AUTORAG.md
**Quick Start Guide for AutoRAG Integration**

Contains step-by-step setup instructions for:
- Cloudflare AutoRAG configuration
- Environment variables for AutoRAG
- Service API token setup
- Bulk upload procedures
- Testing and troubleshooting

**When to read**: Setting up AutoRAG for the first time or debugging AutoRAG sync issues.

**Related docs**: `.claude/ARCHITECTURE.md` (AutoRAG Integration section)

### NEON_BACKUP_STRATEGY.md
**Database Backup and Branch Management**

Contains:
- Production and development branch structure
- Backup branch strategy (daily, weekly)
- Development workflow guidelines
- Recovery procedures
- Critical rules for database safety

**When to read**: Before making database changes, setting up backup automation, or recovering from data loss.

**Related docs**: `.claude/STARTUP.md` (Database Management section)

### SECURITY_BEST_PRACTICES.md
**Security Guidelines and Secret Management**

Contains:
- Secret management best practices
- Git hooks for preventing credential leaks
- What to never commit
- Incident response for exposed secrets
- Repository security checklist

**When to read**: Setting up new repositories, onboarding developers, or after security incident.

**Related docs**: `CLAUDE.md` (Core Principles > Environment & Secrets)

## Usage

These files are **reference documents** - they don't need to be read unless you're working on the specific topic they cover.

The essential information from these documents has been integrated into the main `.claude/` documentation, but these files provide more detailed, step-by-step procedures.

## Integration Status

| Reference Doc | Main Documentation | Status |
|---------------|-------------------|--------|
| README_AUTORAG.md | `.claude/ARCHITECTURE.md` | ✅ Key concepts integrated |
| NEON_BACKUP_STRATEGY.md | `.claude/STARTUP.md` | ⚠️ Consider integrating backup procedures |
| SECURITY_BEST_PRACTICES.md | `CLAUDE.md` | ✅ Core principles integrated |

---

*Reference documentation preserved from pre-Thoughtful Dev structure*
