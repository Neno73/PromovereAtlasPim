# Architectural Decision Log

*This file tracks major architectural decisions made in the PromoAtlas PIM system.*

---

## ADR-001: Gemini RAG Integration

**Date**: 2025-11-19 19:46

**Status**: ✅ Implemented

### Context

PromoAtlas PIM needs semantic search capabilities to enable AI-powered product discovery. The system already has Meilisearch for exact/filtered search and Strapi as the source of truth. We need to add RAG (Retrieval Augmented Generation) without disrupting existing functionality.

### Decision

Integrate Google Gemini's File Search API using a **"Headless RAG"** architecture:

1. **FileSearchStore for embeddings**: Use Gemini's persistent FileSearchStore (not temporary files)
2. **JSON format**: Transform products to JSON matching Meilisearch payload for consistency
3. **Auto-sync**: Hook into existing promidata-sync to automatically upload products on update
4. **Separate frontend**: Frontend will be in a separate Next.js repo using Vercel AI SDK with tool calling
5. **Operation polling**: Properly poll upload operations until completion per Google's docs

### Alternatives Considered

#### 1. Use Gemini Files API (Direct Upload)
- **Pro**: Simpler API, no store management
- **Con**: Files expire after 48 hours, not suitable for persistent RAG
- **Status**: ❌ Rejected - Need persistent storage

#### 2. Upload to FileSearchStore without polling
- **Pro**: Faster initial implementation
- **Con**: Would fail silently, not following best practices
- **Status**: ❌ Rejected - Google docs explicitly require polling

#### 3. Markdown format instead of JSON
- **Pro**: More readable for LLMs
- **Con**: Inconsistent with Meilisearch, harder to maintain
- **Status**: ❌ Rejected - Consistency more important

#### 4. Replace Meilisearch with Gemini
- **Pro**: Simplify stack
- **Con**: Gemini not optimized for exact match/faceted search, more expensive
- **Status**: ❌ Rejected - Use both for different purposes

### Consequences

**Positive:**
- ✅ Persistent embedding storage (FileSearchStore)
- ✅ Consistent data format across search systems
- ✅ Auto-sync keeps embeddings up-to-date
- ✅ Follows Google's official best practices
- ✅ Non-destructive (can be removed if needed)
- ✅ Enables AI-powered product discovery

**Negative:**
- ⚠️ Additional API dependency (Gemini)
- ⚠️ Costs for Gemini API usage (minimal for our scale)
- ⚠️ Requires operation polling (3-6s per upload)

**Neutral:**
- 📝 Frontend needs to orchestrate between Gemini, Meilisearch, and Strapi
- 📝 Requires `GEMINI_API_KEY` environment variable

### Implementation Details

**Files Created:**
- `backend/src/services/gemini/gemini-service.ts` - Singleton service for Gemini API
- `backend/src/services/gemini/transformers/product-to-json.ts` - Product → JSON transformer
- `backend/src/api/gemini-sync/` - Admin endpoints for manual control

**Files Modified:**
- `backend/src/api/promidata-sync/services/promidata-sync.ts` - Added auto-sync hook
- `backend/src/api/product/content-types/product/schema.json` - Added `gemini_file_uri` field

**Configuration:**
- Environment: `GEMINI_API_KEY=AIzaSy...`
- Store: `fileSearchStores/promoatlas-product-catalog-xfex8hxfyifx`

### Testing

- ✅ 5/5 real products synced successfully
- ✅ Operation polling working correctly
- ✅ Document references stored in database
- ✅ Follows Google's official implementation example

### References

- [Google Gemini File Search Docs](https://ai.google.dev/gemini-api/docs/file-search)
- [Google RAG Example (GitHub)](https://github.com/Neno73/google-rag-example)
- [Implementation Walkthrough](file:///home/neno/.gemini/antigravity/brain/e8e60a97-b2e3-4fe1-b425-d9c942d7e976/walkthrough.md)

---

## Template for Future ADRs

```markdown
## ADR-XXX: [Title]

**Date**: YYYY-MM-DD HH:MM

**Status**: 🚧 Proposed | ✅ Implemented | ❌ Rejected | 🔄 Superseded

### Context
[What is the issue we're seeing that is motivating this decision?]

### Decision
[What is the change we're actually proposing/doing?]

### Alternatives Considered
[What other options did we consider? Why were they rejected?]

### Consequences
**Positive:** [What becomes easier?]
**Negative:** [What becomes harder?]
**Neutral:** [What stays the same?]

### Implementation Details
[Key technical details, file changes, configuration]

### References
[Links to docs, discussions, related tickets]
```

---

*When adding new ADRs:*
1. Use next sequential number (ADR-002, ADR-003, etc.)
2. Include timestamp in 24-hour format
3. Update status as implementation progresses
4. Link to relevant documentation/code
