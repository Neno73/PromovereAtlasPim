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
  currency: string;
}

export interface Dimensions {
  id: number;
  length?: number;
  width?: number;
  height?: number;
  diameter?: number;
  weight?: number;
  unit: 'cm' | 'mm' | 'm' | 'in';
  weight_unit: 'g' | 'kg' | 'oz' | 'lb';
}

export interface Media {
  id: number;
  name: string;
  url: string;
  alternativeText?: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface ProductVariant {
  id: number;
  documentId: string;
  sku: string;
  name?: string;
  description?: string;
  color?: string;
  size?: string;
  sizes?: string[];
  hex_color?: string;
  supplier_color_code?: string;
  material?: string;
  dimensions_length?: number;
  dimensions_width?: number;
  dimensions_height?: number;
  dimensions_diameter?: number;
  weight?: number;
  primary_image?: Media;
  gallery_images?: Media[];
  is_primary_for_color: boolean;
  is_active: boolean;
  product?: {
    id: number;
    documentId: string;
  };
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface Product {
  id: number;
  documentId: string;
  sku: string;
  model?: string;
  article_number?: string;
  sku_supplier?: string;
  ean?: string;
  name: MultilingualText;
  description?: MultilingualText;
  model_name?: MultilingualText;
  dimension?: string;
  meta_keyword?: string;
  weight?: number;
  brand?: string;
  material?: MultilingualText;
  country_of_origin?: string;
  delivery_time?: string;
  customs_tariff_number?: string;
  tax: 'H' | 'L';
  filter_codes?: string;
  main_category?: string;
  additional_categories?: string;
  maxcolors?: number;
  print_option_group?: string;
  must_have_imprint: boolean;
  customization?: any;
  refining?: any;
  refining_dimensions?: any;
  refining_location?: any;
  is_active: boolean;
  promidata_hash?: string;
  last_synced?: string;
  total_variants_count?: number;
  dimensions?: Dimensions;
  price_tiers?: PriceTier[];
  main_image?: Media;
  gallery_images?: Media[];
  model_image?: Media;
  variants?: ProductVariant[];
  categories?: Category[];
  supplier?: {
    id: number;
    documentId: string;
    name: string;
    code: string;
    is_active: boolean;
    auto_import: boolean;
    createdAt: string;
    updatedAt: string;
  };
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface Category {
  id: number;
  documentId: string;
  code: string;
  name: MultilingualText;
  sort_order: number;
  parent?: {
    data: Category;
  };
  children?: {
    data: Category[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: number;
  documentId: string;
  name: string;
  code: string;
  website?: string;
  email?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  data: T;
  meta: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

/**
 * Meilisearch-specific fields that extend Product
 * Used when products come from Meilisearch instead of Strapi API
 */
export interface MeilisearchFields {
  // Flat multilingual fields
  name_en?: string;
  name_de?: string;
  name_fr?: string;
  name_es?: string;
  description_en?: string;
  description_de?: string;
  description_fr?: string;
  description_es?: string;
  // Flat price fields
  price_min?: number;
  price_max?: number;
  currency?: string;
  // Flat supplier/category
  supplier_name?: string;
  supplier_code?: string;
  category?: string;
  // Flat image URL
  main_image_url?: string;
  // Color arrays
  colors?: string[];
  hex_colors?: string[];
  // Index signature for dynamic field access (e.g., name_${lang})
  [key: string]: string | number | string[] | undefined;
}

/**
 * Combined product type that supports both Strapi and Meilisearch formats
 */
export type ProductData = Product & MeilisearchFields;

/**
 * Verification status for a product
 * Used in ProductList to show sync badges
 */
export interface VerificationStatus {
  inMeilisearch: boolean;
  inGemini: boolean;
  hashMatches: boolean;
  imageCount: number;
  lastSynced: string | null;
}
