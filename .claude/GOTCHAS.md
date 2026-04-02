# Known Issues & Workarounds

*Last updated: 2026-04-02*

Active gotchas in PromoAtlas PIM. Fixed issues archived in git history.

## Backend

| Issue | Description | Workaround |
|-------|-------------|------------|
| **Strapi 5 ID Types** | `entityService` requires numeric `id`, but URLs/relations use `documentId` (UUID) | Use `db.query().findOne({ where: { documentId } })` to get numeric `id` first |
| **entityService Deprecated** | `strapi.entityService` deprecated in 5.40+, 48 calls in 11 files | Still works in 5.41. Migrate to `strapi.documents()` incrementally before Strapi 6 |
| **Promidata SKU Case** | Promidata JSON uses `Sku` (camelCase), not `SKU` or `sku` | Always check all three: `variants[0].SKU \|\| variants[0].sku \|\| variants[0].Sku` |
| **Repeatable Components** | Strapi 5 expects arrays for repeatable components, `undefined` causes errors | Return `[]` instead of `undefined` for empty repeatable fields |
| **Hash Sync Limitations** | If Promidata changes product but keeps same hash, update missed | Run full sync periodically: `UPDATE products SET promidata_hash = NULL;` |
| **Pricing Region Dynamic** | Region key is BENELUX or EURO depending on supplier, not standardized | Use `selectPriceRegion()` helper: BENELUX > EURO > first available |
| **HexColor Two Locations** | `NonLanguageDependedProductDetails.HexColor` is usually null | Also check `ProductDetails.{lang}.UnstructuredInformation.HexColor` (A403 pattern) |
| **ConfigurationFields Non-Standard** | A73 uses `49P_CONFIG_1` instead of `Color` | Check `ConfigurationNameTranslated` for hints, don't assume field names |
| **Languages Not Universal** | NL + DE always present, EN missing from A403, FR missing from A73 | Always handle missing languages gracefully in extractors |
| **Connection Pool Exhaustion** | Large syncs may exhaust 10-connection pool | Sync during low-traffic; increase pool in `database.ts` |

## Promidata Integration

| Issue | Description | Workaround |
|-------|-------------|------------|
| **Rate Limiting** | No retry logic for 429 errors | `promidata-client.ts` has exponential backoff built in |
| **String Booleans** | `ProductFiltersByGroup` values are `"True"` not `true` | Parse as strings, not booleans |
| **Root vs Child Data** | Root has zeroed dimensions/prices, only 1 price tier | Always use ChildProducts[] for real data |

## Frontend

| Issue | Description | Workaround |
|-------|-------------|------------|
| **Image Aspect Ratio** | Hard-coded thresholds (1.2-1.8) may not fit all images | Default `contain` is safe; some images have white space |
| **AI SDK UIMessage Format** | `useChat` sends UIMessages (parts array), `streamText` expects ModelMessages | Use `convertToModelMessages()` from `ai` package in `/api/chat/route.ts` |
| **Chat Panel Must Stay Mounted** | Returning `null` when closed destroys `useChat` state (all messages lost) | Use CSS `hidden` class, never `if (!open) return null` |
| **Tool-Grid Result Mismatch** | AI tool queries MeiliSearch independently; if it doesn't carry forward existing filters, tool count differs from grid | Tool now merges AI args with `currentFilters` on server before querying |
| **Hybrid Search Latency** | Hybrid search with embeddings takes ~2s vs ~50ms keyword-only | Only activates when text query is present; filter-only searches stay fast |
| **AI SDK v6 useChat Transport** | `useChat()` no longer accepts `api` option directly. Must use `transport: new DefaultChatTransport({ api: "/api/chat-bot" })` from `ai` package | Import `DefaultChatTransport` from `ai`, pass via `transport` option |
| **AI SDK v6 Tool Part States** | Tool part `state` values changed in v6. No `"call"` or `"partial-call"` states. Valid streaming states are `"input-streaming"` and `"streaming"` | Check SDK types for valid states before using in conditionals |
| **React.memo + useMemo Order** | `useMemo` inside a `React.memo` component must be called before any early returns, or React throws "rendered more hooks" error | Always place all hooks above conditional returns |

## Infrastructure

| Issue | Description | Workaround |
|-------|-------------|------------|
| **Dual MeiliSearch Sync** | Plugin writes to `pim_products`, custom service to `MEILISEARCH_INDEX_NAME` | Consolidate to one path (planned) |
| **CORS localhost only** | `middlewares.ts` only allows localhost origins | Add production FE domain before deploying |

## Security Notes

- **Public API**: Products/categories/suppliers publicly readable (intentional). Consider rate limiting.
- **Admin JWT**: Stored in localStorage. Keep Strapi updated, use HTTPS, rotate passwords.

---

*Update when discovering new issues. Archive fixed issues by removing them.*
