import { streamText, tool, stepCountIs, convertToModelMessages } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { readPrompts } from "@/app/api/admin/prompts/route";

export const maxDuration = 30;

const STRAPI_BASE = process.env.STRAPI_INTERNAL_URL || "http://localhost:1337";

// ---------------------------------------------------------------------------
// Build system prompt from saved prompt sections + dynamic catalog context
// ---------------------------------------------------------------------------

async function buildSystemPrompt(
  currentFilters?: Record<string, unknown>,
  currentFacets?: Record<string, Record<string, number>>,
  currentTotal?: number,
): Promise<string> {
  const p = await readPrompts();

  const sections = [
    p.regularPrompt,
    p.companyKnowledge ? `\n\n## Company Knowledge\n${p.companyKnowledge}` : "",
    p.industryKnowledge
      ? `\n\n## Industry Knowledge\n${p.industryKnowledge}`
      : "",
    p.preSearchQuestions
      ? `\n\n## Pre-Search Questions\n${p.preSearchQuestions}`
      : "",
    p.productSearchFlow
      ? `\n\n## Product Search Flow\n${p.productSearchFlow}`
      : "",
    p.brandVoice ? `\n\n## Brand Voice & Tone\n${p.brandVoice}` : "",
  ];

  const dynamicPrompt = sections.filter(Boolean).join("");

  // Build dynamic catalog context
  let catalogContext = "";
  if (currentFilters || currentFacets || currentTotal != null) {
    const filterLines: string[] = [];
    if (currentFilters) {
      const f = currentFilters;
      if (f.q) filterLines.push(`- Search query: "${f.q}"`);
      if (f.brand) filterLines.push(`- Brand: ${f.brand}`);
      if (f.category) filterLines.push(`- Category: ${f.category}`);
      if (f.colors) filterLines.push(`- Colors: ${f.colors}`);
      if (f.sizes) filterLines.push(`- Sizes: ${f.sizes}`);
      if (f.price_min != null) filterLines.push(`- Min price: €${f.price_min}`);
      if (f.price_max != null) filterLines.push(`- Max price: €${f.price_max}`);
      if (f.supplier_code) filterLines.push(`- Supplier: ${f.supplier_code}`);
      if (f.ids)
        filterLines.push(
          `- Curated selection: ${String(f.ids).split(",").length} specific products`,
        );
      if (f.sort && f.sort !== "updatedAt:desc")
        filterLines.push(`- Sort: ${f.sort}`);
    }

    const facetSummary: string[] = [];
    if (currentFacets) {
      for (const [facetName, values] of Object.entries(currentFacets)) {
        const topEntries = Object.entries(values)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);
        if (topEntries.length > 0) {
          facetSummary.push(
            `- ${facetName}: ${topEntries.map(([k, v]) => `${k} (${v})`).join(", ")}`,
          );
        }
      }
    }

    catalogContext = `

## Current Catalog State
The user is currently viewing ${currentTotal ?? "unknown"} products${filterLines.length > 0 ? " with these active filters:" : " (no filters applied)."}
${filterLines.join("\n")}
${facetSummary.length > 0 ? `\nAvailable filter options (top values with counts):\n${facetSummary.join("\n")}` : ""}

IMPORTANT: When the user asks about what's available (brands, colors, sizes), answer from the facet data above. Only call the search tool when you need to change the catalog view.
Build on the user's existing filters when refining. Only remove filters the user explicitly asks to remove. To start fresh, set clear to true.`;
  }

  return `${dynamicPrompt}

## Tool Usage
Use the updateCatalogFilters tool to update the product grid, sidebar facets, and URL.

### How search works
Our search engine uses HYBRID search: it combines keyword matching with AI semantic understanding.
- The text query field understands MEANING, not just exact words. "exclusive shirts" finds premium/high-end shirts even if "exclusive" isn't in the product name.
- Category, brand, color, size, and price filters are EXACT — they narrow results precisely.
- You should COMBINE both: use filters for structure, text query for intent/meaning.

### Decompose every request into filters + query

For each user request, extract:

FILTERS (exact, structural):
- category → Product type. Check the facets for codes like "TEXTILES/SHIRTS-TOPS/POLO". ALWAYS use when the user names a product type.
- brand → Exact brand name from facets.
- colors → Comma-separated color names from facets.
- sizes → Comma-separated sizes from facets.
- price_min / price_max → Numeric EUR values.
- sort → "price_min:asc", "price_min:desc", "updatedAt:desc", "brand:asc".
- ids → Comma-separated product IDs for curated final picks.

QUERY (semantic, meaning-based):
- Materials: "organic cotton", "recycled polyester", "bamboo"
- Features: "waterproof", "flame-resistant", "quick-dry"
- Certifications: "GOTS certified", "OEKO-TEX", "Fair Trade"
- Quality/style: "exclusive", "premium", "budget-friendly", "minimalist"
- Purpose: "corporate gift", "outdoor event", "team building"

### Examples

"polo shirts" → category: "TEXTILES/SHIRTS-TOPS/POLO"
  (Pure structural — no query needed)

"sustainable t-shirts" → category: "TEXTILES/SHIRTS-TOPS/T_SHIRTS" + query: "sustainable organic eco-friendly"
  (Category for type, query for the sustainability intent)

"exclusive shirts" → category: "TEXTILES/SHIRTS-TOPS" + query: "exclusive premium high-end" + sort: "price_min:desc"
  (Category for type, query for semantic matching, sort for premium feel)

"corporate gifts under 10 euros" → query: "corporate gifts business professional" + price_max: 10
  (No single category — cross-category intent, let semantic search find the right mix)

"red Gildan t-shirts" → category: "TEXTILES/SHIRTS-TOPS/T_SHIRTS" + brand: "Gildan" + colors: "Red"
  (Pure filters — no query needed)

"something eco-friendly for a trade show" → query: "eco-friendly sustainable trade show giveaway promotional"
  (Broad intent — let semantic search work across categories)

### When NOT to use text query
If the user's request maps entirely to filters, skip the query field. Extra query words can dilute results.
- "red polo shirts" → category + colors (no query needed)
- "Gildan t-shirts under 5 euros" → category + brand + price (no query needed)

### Keep responses SHORT
The grid and sidebar show ALL product details. The user can see everything.
- ONE short sentence about the results (e.g., "Found 68 polo shirts!")
- ONE optional follow-up question if helpful
- NEVER list brands, prices, colors, or sizes — the sidebar shows them
- NEVER describe individual products — the grid shows them
- MAXIMUM 50 words when showing products

### Other guidelines
- If 0 results, the grid keeps the previous view. Suggest relaxing a filter.
- For curated final recommendations, use the ids parameter with specific product IDs.
- When the user asks about available options (brands, colors), answer from the facet data — no tool call needed.${catalogContext}`;
}

async function searchStrapi(params: Record<string, string>) {
  const qs = new URLSearchParams(params);
  qs.set("limit", params.limit || "8");
  qs.set("is_active", "true");
  qs.set("facets", "brand,category,colors,sizes,supplier_name");

  const res = await fetch(`${STRAPI_BASE}/api/products/search?${qs}`, {
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Search API responded ${res.status}`);
  }

  return res.json();
}

export async function POST(req: Request) {
  const {
    messages: uiMessages,
    currentFilters,
    currentFacets,
    currentTotal,
  } = await req.json();

  const systemPrompt = await buildSystemPrompt(
    currentFilters,
    currentFacets,
    currentTotal,
  );

  // Convert UI messages (parts format) to model messages (content format)
  const messages = await convertToModelMessages(uiMessages, {
    ignoreIncompleteToolCalls: true,
  });

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: systemPrompt,
    messages,
    tools: {
      updateCatalogFilters: tool({
        description:
          "Update the product catalog filters shown to the user. Changes are reflected in the product grid, sidebar facets, and URL. Use this whenever the user wants to browse, search, or filter products.",
        inputSchema: z.object({
          query: z
            .string()
            .optional()
            .describe(
              "Text search query for product names, descriptions, materials",
            ),
          brand: z.string().optional().describe("Filter by brand name"),
          category: z.string().optional().describe("Filter by category"),
          colors: z
            .string()
            .optional()
            .describe("Comma-separated color names to filter by"),
          sizes: z
            .string()
            .optional()
            .describe("Comma-separated sizes to filter by"),
          price_min: z.number().optional().describe("Minimum price in EUR"),
          price_max: z.number().optional().describe("Maximum price in EUR"),
          sort: z
            .string()
            .optional()
            .describe(
              "Sort order, e.g. 'price_min:asc', 'price_min:desc', 'updatedAt:desc', 'brand:asc'",
            ),
          ids: z
            .string()
            .optional()
            .describe(
              "Comma-separated product IDs for a curated selection. Use when recommending specific final picks.",
            ),
          limit: z
            .number()
            .optional()
            .default(8)
            .describe("Number of preview results for AI reasoning (default 8)"),
          clear: z
            .boolean()
            .optional()
            .describe(
              "Set true to clear all existing filters before applying new ones",
            ),
        }),
        execute: async (args) => {
          // Start from existing filters (unless clearing) so the tool
          // query matches what the frontend grid will show after merging.
          const base: Record<string, string> = {};
          if (!args.clear && currentFilters) {
            const cf = currentFilters as Record<string, unknown>;
            if (cf.q) base.q = String(cf.q);
            if (cf.brand) base.brand = String(cf.brand);
            if (cf.category) base.category = String(cf.category);
            if (cf.colors) base.colors = String(cf.colors);
            if (cf.sizes) base.sizes = String(cf.sizes);
            if (cf.price_min != null) base.price_min = String(cf.price_min);
            if (cf.price_max != null) base.price_max = String(cf.price_max);
            if (cf.sort) base.sort = String(cf.sort);
            if (cf.ids) base.ids = String(cf.ids);
          }

          // AI args override existing filters
          const params: Record<string, string> = { ...base };
          if (args.query !== undefined) params.q = args.query || "";
          if (args.brand !== undefined) params.brand = args.brand || "";
          if (args.category !== undefined)
            params.category = args.category || "";
          if (args.colors !== undefined) params.colors = args.colors || "";
          if (args.sizes !== undefined) params.sizes = args.sizes || "";
          if (args.price_min != null) params.price_min = String(args.price_min);
          if (args.price_max != null) params.price_max = String(args.price_max);
          if (args.sort !== undefined) params.sort = args.sort || "";
          if (args.ids !== undefined) params.ids = args.ids || "";
          if (args.limit) params.limit = String(args.limit);

          // Remove empty string values so they don't become active filters
          for (const key of Object.keys(params)) {
            if (params[key] === "") delete params[key];
          }

          try {
            const searchResult = await searchStrapi(params);
            const products = searchResult.data || [];

            const total = searchResult.meta?.pagination?.total || 0;

            // If zero results, do NOT send filters_applied — the frontend
            // keeps the previous grid so the user never sees a blank screen.
            // The AI still sees total:0 and can suggest alternatives.
            if (total === 0) {
              return {
                filters_applied: null,
                total: 0,
                sample_products: [],
                available_facets: searchResult.meta?.facets || {},
                no_results_for: { ...params, limit: undefined },
              };
            }

            // Build filters_applied: full replacement set for the frontend.
            // Include inherited filters so the frontend knows the complete state.
            const filters_applied: Record<string, unknown> = {};
            if (params.q) filters_applied.q = params.q;
            if (params.brand) filters_applied.brand = params.brand;
            if (params.category) filters_applied.category = params.category;
            if (params.colors) filters_applied.colors = params.colors;
            if (params.sizes) filters_applied.sizes = params.sizes;
            if (params.price_min)
              filters_applied.price_min = Number(params.price_min);
            if (params.price_max)
              filters_applied.price_max = Number(params.price_max);
            if (params.sort) filters_applied.sort = params.sort;
            if (params.ids) filters_applied.ids = params.ids;

            // Return slim product previews for AI reasoning (save tokens)
            const sample_products = products
              .slice(0, 4)
              .map((p: Record<string, unknown>) => ({
                id: p.id,
                name: p.name_en || p.name_de || p.name_fr || p.sku,
                brand: p.brand,
                price_min: p.price_min,
                price_max: p.price_max,
                currency: p.currency,
                colors: p.colors,
                sizes: p.sizes,
                category: p.category,
              }));

            return {
              filters_applied,
              total,
              sample_products,
              available_facets: searchResult.meta?.facets || {},
            };
          } catch {
            return {
              filters_applied: {},
              total: 0,
              sample_products: [],
              available_facets: {},
              error: "Search failed. Please try again.",
            };
          }
        },
      }),
    },
    stopWhen: stepCountIs(3),
  });

  return result.toUIMessageStreamResponse();
}
