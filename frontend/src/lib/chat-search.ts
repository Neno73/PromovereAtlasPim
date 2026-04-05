// ---------------------------------------------------------------------------
// Shared search helpers for chat API routes
// ---------------------------------------------------------------------------

import type { RichProduct } from "./types";

const STRAPI_BASE = process.env.STRAPI_INTERNAL_URL || "http://localhost:1337";

/**
 * Query the Strapi MeiliSearch search endpoint.
 * Used by both /api/chat and /api/chat-bot routes.
 */
export async function searchStrapi(params: Record<string, string>) {
  const qs = new URLSearchParams(params);
  if (!params.limit) qs.set("limit", "8");
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

/**
 * Map a raw MeiliSearch product document to a RichProduct for inline chat display.
 */
export function mapToRichProduct(p: Record<string, unknown>): RichProduct {
  const name =
    (p.name_en as string) ||
    (p.name_de as string) ||
    (p.name_fr as string) ||
    (p.name_es as string) ||
    (p.sku as string) ||
    "";

  const rawDesc =
    (p.description_en as string) ||
    (p.description_de as string) ||
    (p.description_fr as string) ||
    "";
  const description = rawDesc ? rawDesc.slice(0, 120) : undefined;

  return {
    id: p.id as string,
    name,
    brand: (p.brand as string) || undefined,
    price_min: p.price_min as number | undefined,
    price_max: p.price_max as number | undefined,
    currency: (p.currency as string) || "EUR",
    colors: (p.colors as string[]) || [],
    hex_colors: (p.hex_colors as string[]) || [],
    category: (p.category as string) || undefined,
    supplier_name: (p.supplier_name as string) || "",
    main_image_url: (p.main_image_url as string) || undefined,
    main_image_thumbnail_url:
      (p.main_image_thumbnail_url as string) || undefined,
    color_image_map: (p.color_image_map as Record<string, string>) || undefined,
    description,
  };
}
