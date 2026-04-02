// ---------------------------------------------------------------------------
// PromoAtlas PIM -- shared TypeScript types
// ---------------------------------------------------------------------------

/** Product document returned by the Meilisearch-powered search endpoint */
export interface MeilisearchProduct {
  id: string;
  sku: string;
  a_number: string;

  // Multilingual text (flattened)
  name_en?: string;
  name_de?: string;
  name_fr?: string;
  name_es?: string;

  description_en?: string;
  description_de?: string;
  description_fr?: string;
  description_es?: string;

  material_en?: string;
  material_de?: string;
  material_fr?: string;
  material_es?: string;

  // Identifiers / metadata
  brand?: string;
  supplier_name: string;
  supplier_code: string;
  supplier_sku?: string;

  // Filtering
  is_active: boolean;
  category?: string;
  category_codes: string[];
  country_of_origin?: string;
  delivery_time?: string;

  // Variant aggregates
  colors: string[];
  sizes: string[];
  hex_colors: string[];

  // Pricing
  price_min?: number;
  price_max?: number;
  currency: string;
  price_region?: string;
  minimum_order_quantity?: number;
  quantity_increments?: number;

  // Additional
  ean?: string;
  customs_tariff_number?: string;

  // Timestamps (unix ms)
  createdAt: number;
  updatedAt: number;
  last_synced?: number;

  // Counts
  total_variants_count: number;
  promidata_hash?: string;

  // Images
  main_image_url?: string;
  main_image_thumbnail_url?: string;
}

// ---------------------------------------------------------------------------
// Search API
// ---------------------------------------------------------------------------

export interface SearchParams {
  q?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  facets?: string;
  supplier_code?: string;
  brand?: string;
  category?: string;
  colors?: string;
  sizes?: string;
  price_min?: number;
  price_max?: number;
  is_active?: boolean;
  semantic?: number;
  ids?: string;
}

export interface FacetDistribution {
  [facetName: string]: Record<string, number>;
}

export interface SearchResponse {
  data: MeilisearchProduct[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
    search: {
      query: string;
      processingTimeMs: number;
    };
    facets?: FacetDistribution;
  };
}

// ---------------------------------------------------------------------------
// Strapi detail types (populated product)
// ---------------------------------------------------------------------------

export interface MultilingualText {
  en?: string;
  de?: string;
  fr?: string;
  es?: string;
  [key: string]: string | undefined;
}

export interface PriceTier {
  id: number;
  quantity: number;
  price: number;
  buying_price?: number;
  currency?: string;
  price_type?: "selling" | "buying" | "recommended";
  region?: string;
}

export interface Dimensions {
  id: number;
  length?: number;
  width?: number;
  height?: number;
  diameter?: number;
  weight?: number;
  unit?: string;
  weight_unit?: string;
}

export interface ImprintPosition {
  id: number;
  position?: string;
  technique?: string;
  max_colors?: number;
  size_width?: number;
  size_height?: number;
}

export interface StrapiMedia {
  id: number;
  documentId: string;
  url: string;
  alternativeText?: string;
  width?: number;
  height?: number;
  formats?: {
    thumbnail?: { url: string; width: number; height: number };
    small?: { url: string; width: number; height: number };
    medium?: { url: string; width: number; height: number };
    large?: { url: string; width: number; height: number };
  };
}

export interface ProductVariant {
  id: number;
  documentId: string;
  sku: string;
  name?: string;
  color?: string;
  size?: string;
  sizes?: string[];
  hex_color?: string;
  supplier_color_code?: string;
  dimensions_length?: number;
  dimensions_width?: number;
  dimensions_height?: number;
  dimensions_diameter?: number;
  weight?: number;
  primary_image?: StrapiMedia;
  gallery_images?: StrapiMedia[];
  is_primary_for_color: boolean;
  is_active: boolean;
}

export interface Category {
  id: number;
  documentId: string;
  code: string;
  name: MultilingualText | string;
  sort_order?: number;
  parent?: Category | null;
  children?: Category[];
}

export interface Supplier {
  id: number;
  documentId: string;
  code: string;
  name?: string;
  is_active: boolean;
  products_count?: number;
}

/** Full Strapi product (populated via ?populate=*) */
export interface Product {
  id: number;
  documentId: string;
  sku: string;
  a_number: string;
  supplier_sku?: string;
  supplier_name?: string;
  brand?: string;
  category?: string;
  total_variants_count: number;
  available_colors?: string[];
  available_sizes?: string[];
  hex_colors?: string[];
  price_min?: number;
  price_max?: number;
  rag_metadata?: Record<string, unknown>;

  name: MultilingualText;
  description?: MultilingualText;
  model_name?: MultilingualText;
  material?: MultilingualText;
  customization?: MultilingualText;
  refining?: MultilingualText;

  price_tiers?: PriceTier[];
  dimensions?: Dimensions;
  imprint_position?: ImprintPosition[];

  main_image?: StrapiMedia;
  gallery_images?: StrapiMedia[];
  model_image?: StrapiMedia;

  categories?: Category[];
  supplier?: Supplier;
  variants?: ProductVariant[];

  promidata_hash?: string;
  last_synced?: string;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Rich product for inline chat display (includes images + descriptions) */
export interface RichProduct {
  id: string;
  name: string;
  brand?: string;
  price_min?: number;
  price_max?: number;
  currency: string;
  colors: string[];
  hex_colors: string[];
  category?: string;
  supplier_name: string;
  main_image_url?: string;
  main_image_thumbnail_url?: string;
  description?: string;
}

export interface StrapiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface StrapiListResponse<T> {
  data: T[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}
