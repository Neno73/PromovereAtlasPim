// ---------------------------------------------------------------------------
// PromoAtlas PIM -- API client
// ---------------------------------------------------------------------------

import type {
  SearchParams,
  SearchResponse,
  Product,
  Category,
  Supplier,
  StrapiResponse,
  StrapiListResponse,
} from "./types";

const API_BASE = "/api";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Search products (Meilisearch-powered)
// ---------------------------------------------------------------------------

export async function searchProducts(
  params: SearchParams = {},
): Promise<SearchResponse> {
  const qs = new URLSearchParams();

  if (params.q) qs.set("q", params.q);
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.offset != null) qs.set("offset", String(params.offset));
  if (params.sort) qs.set("sort", params.sort);
  if (params.semantic != null) qs.set("semantic", String(params.semantic));
  if (params.supplier_code) qs.set("supplier_code", params.supplier_code);
  if (params.brand) qs.set("brand", params.brand);
  if (params.category) qs.set("category", params.category);
  if (params.colors) qs.set("colors", params.colors);
  if (params.sizes) qs.set("sizes", params.sizes);
  if (params.price_min != null) qs.set("price_min", String(params.price_min));
  if (params.price_max != null) qs.set("price_max", String(params.price_max));
  if (params.is_active != null) qs.set("is_active", String(params.is_active));

  // Always request facets for the sidebar
  qs.set(
    "facets",
    params.facets || "brand,category,colors,sizes,supplier_name",
  );

  return apiFetch<SearchResponse>(`/products/search?${qs.toString()}`);
}

// ---------------------------------------------------------------------------
// Single product detail
// ---------------------------------------------------------------------------

export async function getProduct(documentId: string): Promise<Product> {
  const res = await apiFetch<StrapiResponse<Product>>(
    `/products/${documentId}?populate=*`,
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function getCategories(): Promise<Category[]> {
  const res = await apiFetch<StrapiListResponse<Category>>(
    "/categories?pagination[pageSize]=200&sort=sort_order:asc",
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

export async function getSuppliers(): Promise<Supplier[]> {
  const res = await apiFetch<StrapiListResponse<Supplier>>(
    "/suppliers?pagination[pageSize]=200&sort=code:asc",
  );
  return res.data;
}
