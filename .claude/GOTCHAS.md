# Known Issues & Workarounds

*Last updated: 2026-01-03*

Active gotchas in PromoAtlas PIM. Fixed issues archived in git history.

## Gemini FileSearchStore

| Issue | Description | Workaround |
|-------|-------------|------------|
| **Namespace Confusion** | `files.list()` doesn't show FileSearchStore files (separate namespace) | Verify with semantic search, not `files.list()` |
| **No Individual Deletion** | Can only delete entire store, not individual files | Accept file accumulation; track sync in Strapi via `gemini_file_uri` |
| **Wrong API Format** | `fileSearchStoreIds` doesn't work | Use `config.tools[{ fileSearch: { fileSearchStoreNames: [storeId] } }]` |

**Key Insight**: If semantic search returns products, files ARE uploaded correctly.

## Backend

| Issue | Description | Workaround |
|-------|-------------|------------|
| **Strapi 5 ID Types** | `entityService` requires numeric `id`, but URLs/relations use `documentId` (UUID) | Use `db.query().findOne({ where: { documentId } })` to get numeric `id` first |
| **Promidata SKU Case** | Promidata JSON uses `Sku` (camelCase), not `SKU` or `sku` | Always check all three: `variants[0].SKU \|\| variants[0].sku \|\| variants[0].Sku` |
| **Repeatable Components** | Strapi 5 expects arrays for repeatable components, `undefined` causes errors | Return `[]` instead of `undefined` for empty repeatable fields |
| **Hash Sync Limitations** | If Promidata changes product but keeps same hash, update missed | Run full sync periodically: `UPDATE products SET promidata_hash = NULL;` |
| **Image Upload Timeout** | Large images/slow network cause 30s timeout | Sync one supplier at a time; increase timeout if needed |
| **Connection Pool Exhaustion** | Large syncs may exhaust 10-connection pool | Sync during low-traffic; increase pool in `database.ts` |
| **JSON Field Indexing** | Multilingual JSON fields can't be indexed efficiently | Add computed columns: `name_en TEXT GENERATED ALWAYS AS (name->>'en') STORED` |
| **Upstash KEYS Disabled** | `client.keys('pattern*')` fails on Upstash | Use `SCAN` with cursor iteration instead |

## Frontend

| Issue | Description | Workaround |
|-------|-------------|------------|
| **Image Aspect Ratio** | Hard-coded thresholds (1.2-1.8) may not fit all images | Default `contain` is safe; some images have white space |
| **Brand Filter Performance** | Fetches 1000 products to extract unique brands | Works for now; add backend `/api/products/brands` endpoint for scale |

## Promidata Integration

| Issue | Description | Workaround |
|-------|-------------|------------|
| **Rate Limiting** | No retry logic for 429 errors | Add delay between requests; implement exponential backoff |

## Security Notes

- **Public API**: Products/categories/suppliers publicly readable (intentional). Consider rate limiting.
- **Admin JWT**: Stored in localStorage. Keep Strapi updated, use HTTPS, rotate passwords.

---

*Update when discovering new issues. Archive fixed issues by removing them. Testing/monitoring gaps covered in STACK.md.*
