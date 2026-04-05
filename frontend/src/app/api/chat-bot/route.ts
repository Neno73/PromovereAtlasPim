import { streamText, tool, stepCountIs, convertToModelMessages } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { readPrompts } from "@/app/api/admin/prompts/route";
import { searchStrapi, mapToRichProduct } from "@/lib/chat-search";

export const maxDuration = 30;

// ---------------------------------------------------------------------------
// Build system prompt for standalone chatbot (no catalog grid context)
// ---------------------------------------------------------------------------

async function buildSystemPrompt(): Promise<string> {
  const p = await readPrompts();

  const sections = [
    p.regularPrompt,
    p.companyKnowledge ? `\n\n## Company Knowledge\n${p.companyKnowledge}` : "",
    p.industryKnowledge
      ? `\n\n## Industry Knowledge\n${p.industryKnowledge}`
      : "",
    p.brandVoice ? `\n\n## Brand Voice & Tone\n${p.brandVoice}` : "",
  ];

  const dynamicPrompt = sections.filter(Boolean).join("");

  return `${dynamicPrompt}

## How This Chat Works
You are in a standalone chat interface. There is NO product grid or sidebar — products appear as visual cards INLINE in the conversation. When you search for products, the user sees rich product cards directly in your message.

## Tool Usage
Use the searchProducts tool to find and display products inline. Call it whenever the user asks about products, wants recommendations, or wants to browse.

### How search works
Our search engine uses HYBRID search: keyword matching + AI semantic understanding.
- The text query field understands MEANING, not just exact words.
- Category, brand, color, size, and price filters are EXACT.
- COMBINE both: filters for structure, text query for intent/meaning.

### Decompose every request into filters + query

FILTERS (exact, structural):
- category — Product type codes like "TEXTILES/SHIRTS-TOPS/POLO", "OFFICE/BALLPOINT_PENS-ROLLERS"
- brand — Exact brand name
- colors — Comma-separated color names
- sizes — Comma-separated sizes
- price_min / price_max — EUR values
- sort — "price_min:asc", "price_min:desc", "updatedAt:desc", "brand:asc"

QUERY (semantic, meaning-based):
- Materials: "organic cotton", "recycled polyester", "bamboo"
- Features: "waterproof", "flame-resistant", "quick-dry"
- Certifications: "GOTS certified", "OEKO-TEX", "Fair Trade"
- Quality/style: "exclusive", "premium", "budget-friendly"
- Purpose: "corporate gift", "outdoor event", "trade show"

### Examples
"polo shirts" → category: "TEXTILES/SHIRTS-TOPS/POLO"
"sustainable t-shirts" → category: "TEXTILES/SHIRTS-TOPS/T_SHIRTS" + query: "sustainable organic eco-friendly"
"corporate gifts under 10 euros" → query: "corporate gifts business professional" + price_max: 10
"red Gildan t-shirts" → category: "TEXTILES/SHIRTS-TOPS/T_SHIRTS" + brand: "Gildan" + colors: "Red"

### When NOT to use text query
If the request maps entirely to filters, skip the query field:
- "red polo shirts" → category + colors (no query needed)
- "Gildan t-shirts under 5 euros" → category + brand + price (no query needed)

### Response guidelines
Since products appear as inline cards in the chat:
- Write 1-3 sentences about what you found. You can be a bit more descriptive than a sidebar chat.
- Highlight standout products briefly (e.g., "The Gildan Softstyle is a great value pick").
- End with one optional follow-up question to help narrow down.
- Do NOT list every product's details — the cards show images, prices, and colors.
- If 0 results, suggest relaxing a filter or alternative search terms.

### Product discovery flow
1. ALWAYS search immediately when the user mentions products. Never delay to ask questions first.
2. Use structured filters (category, brand, colors) over text query when possible.
3. After showing results, ask ONE smart follow-up: occasion, budget, or nothing if both are known.
4. Build on previous context — don't make the user repeat themselves.
5. For curated final picks, search with specific product IDs.

### When no results found
If searchProducts returns 0 results:
1. Immediately re-search with broader criteria (drop the most restrictive filter).
2. Show the broader results and mention which constraint was relaxed.
3. Never leave the user without product cards when discussing products.`;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const { messages: uiMessages } = await req.json();

  const systemPrompt = await buildSystemPrompt();

  const messages = await convertToModelMessages(uiMessages, {
    ignoreIncompleteToolCalls: true,
  });

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: systemPrompt,
    messages,
    tools: {
      searchProducts: tool({
        description:
          "Search the product catalog and display product cards inline in the chat. Use this whenever the user asks about products, wants to browse, or needs recommendations.",
        inputSchema: z.object({
          query: z
            .string()
            .optional()
            .describe(
              "Semantic text search query for materials, features, purposes",
            ),
          brand: z.string().optional().describe("Filter by brand name"),
          category: z
            .string()
            .optional()
            .describe(
              "Filter by category code, e.g. TEXTILES/SHIRTS-TOPS/POLO",
            ),
          colors: z.string().optional().describe("Comma-separated color names"),
          sizes: z.string().optional().describe("Comma-separated sizes"),
          price_min: z.number().optional().describe("Minimum price in EUR"),
          price_max: z.number().optional().describe("Maximum price in EUR"),
          sort: z
            .string()
            .optional()
            .describe(
              "Sort order: price_min:asc, price_min:desc, updatedAt:desc, brand:asc",
            ),
          ids: z
            .string()
            .optional()
            .describe(
              "Comma-separated product IDs for a curated selection of specific products",
            ),
          limit: z
            .number()
            .optional()
            .default(8)
            .describe("Number of products to return (default 8, max 12)"),
        }),
        execute: async (args) => {
          const params: Record<string, string> = {};
          if (args.query) params.q = args.query;
          if (args.brand) params.brand = args.brand;
          if (args.category) params.category = args.category;
          if (args.colors) params.colors = args.colors;
          if (args.sizes) params.sizes = args.sizes;
          if (args.price_min != null) params.price_min = String(args.price_min);
          if (args.price_max != null) params.price_max = String(args.price_max);
          if (args.sort) params.sort = args.sort;
          if (args.ids) params.ids = args.ids;
          if (args.limit) params.limit = String(args.limit);

          // Build structured filters for "View all in catalog" link
          const filtersApplied: Record<string, string> = {};
          for (const [k, v] of Object.entries(params)) {
            if (k !== "limit" && v) filtersApplied[k] = v;
          }

          // If the AI filtered by one or more colors, surface the first one
          // as the "active" color so ChatProductCard can render the matching
          // variant image from product.color_image_map.
          const activeColor = args.colors
            ? args.colors.split(",")[0]?.trim() || undefined
            : undefined;

          try {
            const searchResult = await searchStrapi(params);
            const products = searchResult.data || [];
            const total =
              searchResult.meta?.pagination?.total || products.length;

            if (total === 0) {
              return {
                products: [],
                total: 0,
                filters_applied: filtersApplied,
                active_color: activeColor,
                no_results: true,
              };
            }

            const richProducts = products
              .slice(0, args.limit || 8)
              .map(mapToRichProduct);

            return {
              products: richProducts,
              total,
              filters_applied: filtersApplied,
              active_color: activeColor,
              no_results: false,
            };
          } catch {
            return {
              products: [],
              total: 0,
              query_used: "",
              no_results: true,
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
