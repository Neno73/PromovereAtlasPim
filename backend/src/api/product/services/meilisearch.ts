/**
 * Meilisearch Service
 *
 * Handles all Meilisearch operations for PromoAtlas PIM:
 * - Index initialization and configuration
 * - Document transformation (Strapi → Meilisearch)
 * - Search operations with typo tolerance and faceting
 * - Bulk indexing for initial sync
 *
 * @module MeilisearchService
 */

import { MeiliSearch, Index } from 'meilisearch';
import type {
  MeilisearchProductDocument,
  MeilisearchSearchOptions,
  MeilisearchSearchResponse,
  MeilisearchIndexSettings,
} from './meilisearch-types';

/**
 * Meilisearch Service Configuration
 */
interface MeilisearchConfig {
  host: string;
  apiKey: string;
  indexName: string;
}

/**
 * Main Meilisearch Service Class
 */
export class MeilisearchService {
  private client: MeiliSearch;
  private index: Index | null = null;
  private config: MeilisearchConfig;
  private strapi: any;

  constructor(strapi: any) {
    this.strapi = strapi;

    // Load configuration from environment variables
    this.config = {
      host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
      apiKey: process.env.MEILISEARCH_ADMIN_KEY || '',
      indexName: process.env.MEILISEARCH_INDEX_NAME || 'products',
    };

    // Validate configuration
    if (!this.config.apiKey) {
      throw new Error('MEILISEARCH_ADMIN_KEY environment variable is required');
    }

    // Initialize Meilisearch client
    this.client = new MeiliSearch({
      host: this.config.host,
      apiKey: this.config.apiKey,
    });

    strapi.log.info(`Meilisearch service initialized: ${this.config.host}`);
  }

  /**
   * Initialize or get existing index
   */
  async initializeIndex(): Promise<Index> {
    try {
      if (this.index) {
        return this.index;
      }

      // Try to get existing index
      try {
        this.index = await this.client.getIndex(this.config.indexName);
        this.strapi.log.info(`Meilisearch index "${this.config.indexName}" found`);

        // NOTE: Removed primary key validation - using Strapi Meilisearch plugin
        // The plugin uses "_meilisearch_id" as primary key, not "id"
      } catch (error) {
        // Index doesn't exist, create it
        this.strapi.log.info(`Creating Meilisearch index: ${this.config.indexName}`);
        const task = await this.client.createIndex(this.config.indexName, {
          primaryKey: 'id', // Use Strapi documentId as primary key
        });

        // Wait for index creation (using SDK's built-in polling)
        await this.client.tasks.waitForTask(task.taskUid);
        this.index = await this.client.getIndex(this.config.indexName);
        this.strapi.log.info(`Meilisearch index "${this.config.indexName}" created with primary key: id`);
      }

      // Configure index settings
      await this.configureIndexSettings();

      return this.index;
    } catch (error) {
      this.strapi.log.error('Failed to initialize Meilisearch index', error);
      throw error;
    }
  }

  /**
   * Configure index settings (searchable attributes, filters, etc.)
   */
  async configureIndexSettings(): Promise<void> {
    if (!this.index) {
      throw new Error('Index not initialized. Call initializeIndex() first.');
    }

    const settings: MeilisearchIndexSettings = {
      // Searchable attributes (ordered by ranking priority)
      searchableAttributes: [
        'sku',                   // Highest priority: exact SKU matches
        'a_number',              // Product family identifier
        'name_en',               // English name
        'name_de',               // German name
        'name_fr',               // French name
        'name_es',               // Spanish name
        'brand',                 // Brand name
        'supplier_name',         // Supplier name
        'description_en',        // English description
        'description_de',        // German description
        'description_fr',        // French description
        'description_es',        // Spanish description
        'short_description_en',  // Short descriptions
        'short_description_de',
        'short_description_fr',
        'short_description_es',
        'material_en',           // Material descriptions
        'material_de',
        'material_fr',
        'material_es',
      ],

      // Filterable attributes (can be used in filter expressions)
      filterableAttributes: [
        'is_active',
        'supplier_code',
        'supplier_name',
        'category',
        'category_codes',
        'brand',
        'country_of_origin',
        'delivery_time',
        'colors',
        'sizes',
        'hex_colors',
        'price_min',
        'price_max',
        'currency',
        'price_region',
        'minimum_order_quantity',
        'total_variants_count',
        'ean',
        'customs_tariff_number',
      ],

      // Sortable attributes
      sortableAttributes: [
        'updatedAt',
        'createdAt',
        'sku',
        'brand',
        'price_min',
        'price_max',
        'minimum_order_quantity',
        'total_variants_count',
      ],

      // Ranking rules (order matters)
      rankingRules: [
        'words',        // Number of query words matched
        'typo',         // Fewer typos = higher rank
        'proximity',    // Words closer together = higher rank
        'attribute',    // Earlier attributes = higher rank (SKU > name > description)
        'sort',         // Custom sort if specified
        'exactness',    // Exact matches = higher rank
      ],

      // Typo tolerance configuration
      typoTolerance: {
        enabled: true,
        minWordSizeForTypos: {
          oneTypo: 4,   // Allow 1 typo for words >= 4 chars
          twoTypos: 8,  // Allow 2 typos for words >= 8 chars
        },
        disableOnWords: ['sku', 'a_number'], // No typo tolerance for exact IDs
        disableOnAttributes: ['sku', 'a_number'],
      },

      // Faceting configuration
      faceting: {
        maxValuesPerFacet: 100,
        sortFacetValuesBy: {
          brand: 'alpha',           // Sort brands alphabetically
          supplier_name: 'alpha',
          category: 'alpha',
          colors: 'count',          // Sort colors by frequency
          sizes: 'count',
        },
      },

      // Pagination
      pagination: {
        maxTotalHits: 10000, // Maximum searchable documents
      },

      // Displayed attributes (fields returned in search results)
      displayedAttributes: [
        '*', // Return all attributes by default
      ],

      // Stop words (common words to ignore)
      stopWords: [],

      // Synonyms (optional - add product-specific synonyms)
      synonyms: {
        'tshirt': ['t-shirt', 't shirt', 'tee'],
        'cap': ['hat', 'beanie'],
        // Add more synonyms as needed
      },
    };

    try {
      this.strapi.log.info('Configuring Meilisearch index settings...');
      const task = await this.index.updateSettings(settings);
      await this.client.tasks.waitForTask(task.taskUid);
      this.strapi.log.info('Meilisearch index settings configured successfully');
    } catch (error) {
      this.strapi.log.error('Failed to configure Meilisearch index settings', error);
      throw error;
    }
  }

  /**
   * Search products with advanced options
   */
  async searchProducts(
    options: MeilisearchSearchOptions
  ): Promise<MeilisearchSearchResponse<MeilisearchProductDocument>> {
    if (!this.index) {
      await this.initializeIndex();
    }

    const {
      query = '',
      limit = 20,
      offset = 0,
      hybrid,
      filters = [],
      facets = [],
      sort = [],
      attributesToRetrieve = ['*'],
      attributesToHighlight = [],
      attributesToCrop = [],
      cropLength = 200,
    } = options;

    try {
      // Build filter string (AND logic)
      const filterString = filters.length > 0 ? filters.join(' AND ') : undefined;

      // Build search params
      const searchParams: Record<string, unknown> = {
        limit,
        offset,
        filter: filterString,
        facets,
        sort,
        attributesToRetrieve,
        attributesToHighlight,
        attributesToCrop,
        cropLength,
      };

      // Add hybrid search if configured
      if (hybrid) {
        searchParams.hybrid = {
          semanticRatio: hybrid.semanticRatio ?? 0.5,
          embedder: hybrid.embedder || 'product_search',
        };
      }

      // Execute search
      const searchResults = await this.index!.search(query, searchParams);

      // Return normalized response
      return {
        hits: searchResults.hits as MeilisearchProductDocument[],
        query: searchResults.query,
        processingTimeMs: searchResults.processingTimeMs,
        limit: searchResults.limit,
        offset: searchResults.offset,
        estimatedTotalHits: searchResults.estimatedTotalHits,
        facetDistribution: searchResults.facetDistribution,
        facetStats: searchResults.facetStats,
      };
    } catch (error) {
      this.strapi.log.error('Meilisearch search failed', error);
      throw error;
    }
  }

  /**
   * Get index statistics
   */
  async getStats() {
    if (!this.index) {
      await this.initializeIndex();
    }

    return this.index!.getStats();
  }

  /**
   * Check Meilisearch health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const health = await this.client.health();
      return health.status === 'available';
    } catch (error) {
      this.strapi.log.error('Meilisearch health check failed', error);
      return false;
    }
  }
}

/**
 * Factory function to create Meilisearch service instance
 */
export default ({ strapi }: { strapi: any }) => {
  return new MeilisearchService(strapi);
};
