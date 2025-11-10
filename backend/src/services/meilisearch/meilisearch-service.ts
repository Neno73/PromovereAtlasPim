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

import { MeiliSearch, Index, EnqueuedTask } from 'meilisearch';
import type {
  MeilisearchProductDocument,
  MeilisearchSearchOptions,
  MeilisearchSearchResponse,
  MeilisearchIndexSettings,
  MeilisearchIndexStats,
  MeilisearchBulkIndexBatch,
} from './types';

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
      } catch (error) {
        // Index doesn't exist, create it
        this.strapi.log.info(`Creating Meilisearch index: ${this.config.indexName}`);
        const task = await this.client.createIndex(this.config.indexName, {
          primaryKey: 'id', // Use Strapi documentId as primary key
        });

        // Wait for index creation
        // @ts-ignore - MeiliSearch SDK types incomplete
        await this.client.waitForTask(task.taskUid as number);
        this.index = await this.client.getIndex(this.config.indexName);
        this.strapi.log.info(`Meilisearch index "${this.config.indexName}" created`);
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
        'total_variants_count',
      ],

      // Sortable attributes
      sortableAttributes: [
        'updatedAt',
        'createdAt',
        'sku',
        'brand',
        'price_min',
        'price_max',
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
      // @ts-ignore - MeiliSearch SDK types incomplete
      await this.client.waitForTask(task.taskUid as number);
      this.strapi.log.info('Meilisearch index settings configured successfully');
    } catch (error) {
      this.strapi.log.error('Failed to configure Meilisearch index settings', error);
      throw error;
    }
  }

  /**
   * Transform Strapi product to Meilisearch document
   */
  async transformProductToDocument(
    product: any
  ): Promise<MeilisearchProductDocument> {
    // Extract multilingual fields from JSON
    const name = product.name || {};
    const description = product.description || {};
    const shortDescription = product.short_description || {};
    const material = product.material || {};

    // Extract unique colors and sizes from variants
    const colors: string[] = [];
    const sizes: string[] = [];
    const hexColors: string[] = [];

    if (product.variants && Array.isArray(product.variants)) {
      product.variants.forEach((variant: any) => {
        if (variant.color && !colors.includes(variant.color)) {
          colors.push(variant.color);
        }
        if (variant.size && !sizes.includes(variant.size)) {
          sizes.push(variant.size);
        }
        if (variant.hex_color && !hexColors.includes(variant.hex_color)) {
          hexColors.push(variant.hex_color);
        }
        // Also extract sizes from JSON array if present
        if (variant.sizes && Array.isArray(variant.sizes)) {
          variant.sizes.forEach((size: string) => {
            if (!sizes.includes(size)) {
              sizes.push(size);
            }
          });
        }
      });
    }

    // Extract category codes
    const categoryCodesList: string[] = [];
    let primaryCategory = '';
    if (product.categories && Array.isArray(product.categories)) {
      product.categories.forEach((cat: any) => {
        if (cat.code) {
          categoryCodesList.push(cat.code);
          if (!primaryCategory) {
            primaryCategory = typeof cat.name === 'object' ? cat.name.en || cat.code : cat.name;
          }
        }
      });
    }

    // Extract price range from price_tiers
    let priceMin: number | undefined;
    let priceMax: number | undefined;
    let currency = 'EUR';

    if (product.price_tiers && Array.isArray(product.price_tiers)) {
      product.price_tiers.forEach((tier: any) => {
        if (tier.price && tier.price_type === 'selling') {
          if (!priceMin || tier.price < priceMin) {
            priceMin = tier.price;
          }
          if (!priceMax || tier.price > priceMax) {
            priceMax = tier.price;
          }
          if (tier.currency) {
            currency = tier.currency;
          }
        }
      });
    }

    // Extract main image URL
    let mainImageUrl: string | undefined;
    let mainImageThumbnailUrl: string | undefined;
    if (product.main_image) {
      if (typeof product.main_image === 'object') {
        mainImageUrl = product.main_image.url;
        mainImageThumbnailUrl = product.main_image.formats?.thumbnail?.url || product.main_image.url;
      } else if (typeof product.main_image === 'string') {
        mainImageUrl = product.main_image;
        mainImageThumbnailUrl = product.main_image;
      }
    }

    // Build Meilisearch document
    const document: MeilisearchProductDocument = {
      id: product.documentId,
      sku: product.sku,
      a_number: product.a_number,

      // Multilingual names (flattened)
      name_en: name.en,
      name_de: name.de,
      name_fr: name.fr,
      name_es: name.es,

      // Multilingual descriptions
      description_en: description.en,
      description_de: description.de,
      description_fr: description.fr,
      description_es: description.es,

      // Short descriptions
      short_description_en: shortDescription.en,
      short_description_de: shortDescription.de,
      short_description_fr: shortDescription.fr,
      short_description_es: shortDescription.es,

      // Materials
      material_en: material.en,
      material_de: material.de,
      material_fr: material.fr,
      material_es: material.es,

      // Single-value searchable fields
      brand: product.brand,
      supplier_name: product.supplier?.name || product.supplier_name || '',
      supplier_code: product.supplier?.code || '',
      supplier_sku: product.supplier_sku,

      // Filterable fields
      is_active: product.is_active !== false, // Default true
      category: primaryCategory,
      category_codes: categoryCodesList,
      country_of_origin: product.country_of_origin,
      delivery_time: product.delivery_time,

      // Product attributes
      colors,
      sizes,
      hex_colors: hexColors,

      // Pricing
      price_min: priceMin,
      price_max: priceMax,
      currency,

      // Timestamps (convert to Unix timestamp for sorting)
      createdAt: new Date(product.createdAt).getTime(),
      updatedAt: new Date(product.updatedAt).getTime(),
      last_synced: product.last_synced ? new Date(product.last_synced).getTime() : undefined,

      // Metadata
      total_variants_count: product.total_variants_count || 0,
      promidata_hash: product.promidata_hash,

      // Image URLs
      main_image_url: mainImageUrl,
      main_image_thumbnail_url: mainImageThumbnailUrl,
    };

    return document;
  }

  /**
   * Add or update a single product document
   */
  async addOrUpdateDocument(product: any): Promise<EnqueuedTask> {
    if (!this.index) {
      await this.initializeIndex();
    }

    const document = await this.transformProductToDocument(product);
    const task = await this.index!.addDocuments([document]);

    this.strapi.log.debug(`Enqueued Meilisearch add/update for product ${product.sku}`);
    return task;
  }

  /**
   * Delete a product document
   */
  async deleteDocument(documentId: string): Promise<EnqueuedTask> {
    if (!this.index) {
      await this.initializeIndex();
    }

    const task = await this.index!.deleteDocument(documentId);
    this.strapi.log.debug(`Enqueued Meilisearch delete for document ${documentId}`);
    return task;
  }

  /**
   * Bulk add/update documents (for initial indexing or reindex)
   */
  async bulkAddOrUpdateDocuments(
    products: any[],
    batchSize: number = 1000
  ): Promise<MeilisearchIndexStats> {
    if (!this.index) {
      await this.initializeIndex();
    }

    const stats: MeilisearchIndexStats = {
      totalDocuments: products.length,
      indexedDocuments: 0,
      failedDocuments: 0,
      processingTimeMs: 0,
      errors: [],
    };

    const startTime = Date.now();

    // Process in batches
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(products.length / batchSize);

      this.strapi.log.info(
        `Indexing batch ${batchNumber}/${totalBatches} (${batch.length} products)`
      );

      try {
        // Transform all products in batch
        const documents = await Promise.all(
          batch.map((product) => this.transformProductToDocument(product))
        );

        // Add documents to Meilisearch
        const task = await this.index!.addDocuments(documents);

        // Wait for task completion
        // @ts-ignore - MeiliSearch SDK types incomplete
        await this.client.waitForTask(task.taskUid as number);

        // Check task status
        // @ts-ignore - MeiliSearch SDK types incomplete
        const taskInfo = await this.client.getTask(task.taskUid as number);
        if (taskInfo.status === 'succeeded') {
          stats.indexedDocuments += batch.length;
        } else {
          stats.failedDocuments += batch.length;
          stats.errors.push({
            documentId: `batch-${batchNumber}`,
            error: taskInfo.error?.message || 'Unknown error',
          });
        }
      } catch (error) {
        this.strapi.log.error(`Failed to index batch ${batchNumber}`, error);
        stats.failedDocuments += batch.length;
        stats.errors.push({
          documentId: `batch-${batchNumber}`,
          error: error.message || 'Unknown error',
        });
      }
    }

    stats.processingTimeMs = Date.now() - startTime;

    this.strapi.log.info(
      `Bulk indexing complete: ${stats.indexedDocuments}/${stats.totalDocuments} indexed, ` +
        `${stats.failedDocuments} failed, ${stats.processingTimeMs}ms`
    );

    return stats;
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

      // Execute search
      const searchResults = await this.index!.search(query, {
        limit,
        offset,
        filter: filterString,
        facets,
        sort,
        attributesToRetrieve,
        attributesToHighlight,
        attributesToCrop,
        cropLength,
      });

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
  async getIndexStats() {
    if (!this.index) {
      await this.initializeIndex();
    }

    const stats = await this.index!.getStats();
    return stats;
  }

  /**
   * Clear all documents from index (use with caution!)
   */
  async clearIndex(): Promise<EnqueuedTask> {
    if (!this.index) {
      await this.initializeIndex();
    }

    this.strapi.log.warn('Clearing all documents from Meilisearch index');
    const task = await this.index!.deleteAllDocuments();
    return task;
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
