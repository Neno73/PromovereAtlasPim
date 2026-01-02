/**
 * Meilisearch Types
 *
 * TypeScript interfaces for Meilisearch integration in PromoAtlas PIM.
 * Defines document structure, search options, and filter types.
 */

/**
 * Product document structure in Meilisearch index
 * Flattened structure with multilingual fields as separate attributes
 */
export interface MeilisearchProductDocument {
  // Primary identifiers
  id: string;                    // Strapi documentId (for fetching full product)
  sku: string;                   // Product SKU (highly ranked in search)
  a_number: string;              // Product family identifier

  // Searchable text fields (multilingual - flattened from JSON)
  name_en?: string;
  name_de?: string;
  name_fr?: string;
  name_es?: string;

  description_en?: string;
  description_de?: string;
  description_fr?: string;
  description_es?: string;

  short_description_en?: string;
  short_description_de?: string;
  short_description_fr?: string;
  short_description_es?: string;

  material_en?: string;
  material_de?: string;
  material_fr?: string;
  material_es?: string;

  // Searchable single-value fields
  brand?: string;
  supplier_name: string;
  supplier_code: string;
  supplier_sku?: string;

  // Filterable fields
  is_active: boolean;
  category?: string;             // Primary category
  category_codes: string[];      // All category codes (for filtering)
  country_of_origin?: string;
  delivery_time?: string;

  // Product attributes (from variants)
  colors: string[];              // Unique colors from all variants
  sizes: string[];               // Unique sizes from all variants
  hex_colors: string[];          // Hex color codes

  // Pricing (extracted from price_tiers)
  price_min?: number;            // Lowest price (for filtering/sorting)
  price_max?: number;            // Highest price
  currency: string;              // Default: EUR

  // Timestamps (for sorting)
  createdAt: number;             // Unix timestamp
  updatedAt: number;             // Unix timestamp
  last_synced?: number;          // Unix timestamp

  // Metadata
  total_variants_count: number;
  promidata_hash?: string;

  // Image URLs (for search results display)
  main_image_url?: string;
  main_image_thumbnail_url?: string;
}

/**
 * Product Variant document structure (if we want to index variants separately)
 * Currently, we're indexing at Product level with aggregated variant data
 */
export interface MeilisearchVariantDocument {
  id: string;                    // Variant documentId
  sku: string;                   // Variant SKU
  product_id: string;            // Parent product documentId
  product_sku: string;           // Parent product SKU

  name?: string;
  description?: string;

  color?: string;
  size?: string;
  hex_color?: string;
  material?: string;

  dimensions_length?: number;
  dimensions_width?: number;
  dimensions_height?: number;
  weight?: number;

  is_primary_for_color: boolean;
  is_active: boolean;

  primary_image_url?: string;
}

/**
 * Search options for querying Meilisearch
 */
export interface MeilisearchSearchOptions {
  query?: string;                 // Search query text
  limit?: number;                 // Number of results (default: 20)
  offset?: number;                // Pagination offset

  // Filters (Meilisearch filter syntax)
  filters?: string[];             // Array of filter expressions

  // Facets (for faceted filtering)
  facets?: string[];              // Fields to get facet distributions

  // Sorting
  sort?: string[];                // Array of sort expressions (e.g., ['updatedAt:desc'])

  // Attributes to retrieve
  attributesToRetrieve?: string[]; // Specific fields to return (default: all)

  // Highlighting
  attributesToHighlight?: string[]; // Fields to highlight matches

  // Cropping (for long text)
  attributesToCrop?: string[];    // Fields to crop
  cropLength?: number;            // Max length per cropped field
}

/**
 * Meilisearch search response structure
 */
export interface MeilisearchSearchResponse<T = MeilisearchProductDocument> {
  hits: T[];                      // Search results
  query: string;                  // Original search query
  processingTimeMs: number;       // Search duration
  limit: number;                  // Results limit
  offset: number;                 // Results offset
  estimatedTotalHits: number;     // Total matching documents

  facetDistribution?: Record<string, Record<string, number>>; // Facet counts
  facetStats?: Record<string, { min: number; max: number }>; // Numeric facet stats
}

/**
 * Meilisearch index settings configuration
 */
export interface MeilisearchIndexSettings {
  searchableAttributes?: string[]; // Fields to search (ordered by rank)
  filterableAttributes?: string[]; // Fields that can be used in filters
  sortableAttributes?: string[];   // Fields that can be used for sorting
  rankingRules?: string[];         // Custom ranking rules
  stopWords?: string[];            // Words to ignore in search
  synonyms?: Record<string, string[]>; // Synonym groups
  typoTolerance?: {
    enabled?: boolean;
    minWordSizeForTypos?: {
      oneTypo?: number;
      twoTypos?: number;
    };
    disableOnWords?: string[];
    disableOnAttributes?: string[];
  };
  faceting?: {
    maxValuesPerFacet?: number;
    sortFacetValuesBy?: Record<string, 'alpha' | 'count'>;
  };
  pagination?: {
    maxTotalHits?: number;
  };
  displayedAttributes?: string[]; // Fields to return in search results
  distinctAttribute?: string;     // Field to use for deduplication
}

/**
 * Queue job data for Meilisearch sync operations
 */
export interface MeilisearchSyncJobData {
  operation: 'add' | 'update' | 'delete';
  entityType: 'product' | 'product-variant';
  entityId: number;               // Numeric Strapi ID
  documentId: string;             // Strapi documentId (string)
  priority?: number;              // Job priority (higher = more important)
}

/**
 * Bulk indexing batch
 */
export interface MeilisearchBulkIndexBatch {
  documents: MeilisearchProductDocument[];
  batchNumber: number;
  totalBatches: number;
}

/**
 * Indexing statistics
 */
export interface MeilisearchIndexStats {
  totalDocuments: number;
  indexedDocuments: number;
  failedDocuments: number;
  processingTimeMs: number;
  errors: Array<{
    documentId: string;
    error: string;
  }>;
}

/**
 * Filter builder helpers (type-safe filter construction)
 */
export type FilterOperator =
  | '=' | '!='
  | '>' | '>=' | '<' | '<='
  | 'IN' | 'NOT IN'
  | 'TO'  // For range queries: field price TO 100
  | 'EXISTS' | 'NOT EXISTS'
  | 'IS NULL' | 'IS NOT NULL';

export interface FilterExpression {
  field: string;
  operator: FilterOperator;
  value: string | number | boolean | Array<string | number>;
}

/**
 * Facet filter configuration for frontend
 */
export interface FacetConfig {
  field: string;
  label: string;
  type: 'checkbox' | 'range' | 'dropdown';
  sortBy?: 'alpha' | 'count';
}
