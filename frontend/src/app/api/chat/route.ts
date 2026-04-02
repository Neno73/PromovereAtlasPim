import { streamText, tool, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

export const maxDuration = 30;

const STRAPI_BASE =
  process.env.STRAPI_INTERNAL_URL || "http://localhost:1337";

const SYSTEM_PROMPT = `You are the PromoAtlas product search assistant. You help users find promotional products from the catalog.

When a user asks about products, use the searchProducts tool to find matching items.
- For general queries, pass the user's description as the search query
- For specific attributes, use the appropriate filter parameters
- Always search before answering product questions
- Present results in a friendly, concise way
- Mention key details: product name, brand, price range, available colors
- If no products found, suggest broadening the search
- Keep responses short and helpful -- 2-3 sentences max, plus the product cards the UI renders automatically
- Do NOT list products as text when the tool already returns them visually

You can search by:
- Text query (product names, descriptions, materials)
- Brand name
- Category
- Colors (comma-separated)
- Sizes (comma-separated)
- Price range (min/max in EUR)`;

async function searchStrapi(params: Record<string, string>) {
  const qs = new URLSearchParams(params);
  qs.set("limit", params.limit || "8");
  qs.set("is_active", "true");
  qs.set("facets", "brand,category,colors,sizes");

  const res = await fetch(`${STRAPI_BASE}/api/products/search?${qs}`, {
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Search API responded ${res.status}`);
  }

  return res.json();
}

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: SYSTEM_PROMPT,
    messages,
    tools: {
      searchProducts: tool({
        description:
          "Search the PromoAtlas product catalog. Returns matching promotional products with details.",
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
          price_min: z
            .number()
            .optional()
            .describe("Minimum price in EUR"),
          price_max: z
            .number()
            .optional()
            .describe("Maximum price in EUR"),
          limit: z
            .number()
            .optional()
            .default(8)
            .describe("Number of results to return (default 8)"),
        }),
        execute: async (args) => {
          const params: Record<string, string> = {};
          if (args.query) params.q = args.query;
          if (args.brand) params.brand = args.brand;
          if (args.category) params.category = args.category;
          if (args.colors) params.colors = args.colors;
          if (args.sizes) params.sizes = args.sizes;
          if (args.price_min != null)
            params.price_min = String(args.price_min);
          if (args.price_max != null)
            params.price_max = String(args.price_max);
          if (args.limit) params.limit = String(args.limit);

          try {
            const searchResult = await searchStrapi(params);
            return {
              products: searchResult.data || [],
              total: searchResult.meta?.pagination?.total || 0,
              query: args.query || "",
            };
          } catch {
            return {
              products: [],
              total: 0,
              query: "",
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
