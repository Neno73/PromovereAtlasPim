/**
 * Gemini File Search Service
 *
 * Synchronizes products from Meilisearch to Google Gemini FileSearchStore for RAG.
 * 
 * ---
 * 
 * ARCHITECTURE (Single Source of Truth):
 * 
 *   ┌─────────┐    sync     ┌─────────────┐    upload    ┌────────────┐
 *   │ Strapi  │ ──────────> │ Meilisearch │ ───────────> │   Gemini   │
 *   │   DB    │             │   (index)   │              │ FileSearch │
 *   └─────────┘             └─────────────┘              └────────────┘
 *                                 │                            │
 *                                 │ display data               │ semantic search
 *                                 ▼                            ▼
 *                           ┌─────────────────────────────────────┐
 *                           │           Chat UI (atlasv2)         │
 *                           │  AI finds products via Gemini RAG   │
 *                           │  Displays data from Meilisearch     │
 *                           │  → Prevents hallucinations!         │
 *                           └─────────────────────────────────────┘
 * 
 * ---
 * 
 * PRINCIPLE: "Always repair Meilisearch before repairing Gemini"
 * 
 *   - Meilisearch is the source of truth for flattened, aggregated product data
 *   - If product not in Meilisearch → skip Gemini sync (don't fail)
 *   - Chat UI retrieves product IDs via Gemini semantic search
 *   - Chat UI displays actual data from Meilisearch (never from Gemini)
 *   - This prevents AI hallucinations in product display
 * 
 * ---
 * 
 * KEY RESPONSIBILITIES:
 *   1. Read transformed documents FROM Meilisearch (not Strapi DB)
 *   2. Convert Meilisearch documents to Gemini-compatible JSON
 *   3. Upload JSON files to Gemini FileSearchStore
 *   4. Handle bulk sync from Meilisearch index
 * 
 * ---
 * 
 * @module GeminiFileSearchService
 */

import { GoogleGenAI } from '@google/genai';
import type { MeilisearchProductDocument } from '../../product/services/meilisearch-types';

/**
 * Gemini File Search Configuration
 */
interface GeminiConfig {
  apiKey: string;
  projectId: string;
  projectNumber: string;
  storeName: string;
}

/**
 * Gemini-compatible product document structure (JSON format)
 */
interface GeminiProductDocument {
  id: string;
  sku: string;
  a_number: string;

  // Multilingual fields (nested structure for AI to understand language context)
  name: {
    en?: string;
    de?: string;
    fr?: string;
    es?: string;
  };

  description: {
    en?: string;
    de?: string;
    fr?: string;
    es?: string;
  };

  short_description?: {
    en?: string;
    de?: string;
    fr?: string;
    es?: string;
  };

  material?: {
    en?: string;
    de?: string;
    fr?: string;
    es?: string;
  };

  // Product attributes
  brand?: string;
  supplier: {
    name: string;
    code: string;
  };

  // Variant aggregations (from Meilisearch)
  available_colors: string[];
  available_sizes: string[];
  hex_colors: string[];
  total_variants: number;

  // Pricing
  pricing: {
    min: number | null;
    max: number | null;
    currency: string;
  };

  // Product details
  country_of_origin?: string;
  delivery_time?: string;

  // Images (URLs only, not the actual images)
  images: {
    main?: string;
    thumbnail?: string;
  };

  // Metadata for filtering/context
  is_active: boolean;
  category?: string;
  category_codes: string[];

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Bulk sync statistics
 */
interface BulkSyncStats {
  total: number;
  synced: number;
  skipped: number;
  failed: number;
  processingTimeMs: number;
  errors: Array<{ documentId: string; error: string }>;
}

/**
 * Main Gemini File Search Service Class
 * 
 * Provides synchronization of product data from Meilisearch to Gemini FileSearchStore.
 */
export class GeminiFileSearchService {
  private ai: GoogleGenAI;
  private config: GeminiConfig;
  private strapi: any;
  private meilisearchService: any;

  // FileSearchStore caching (prevents redundant API calls)
  private storeId: string | null = null;
  private storeCreationPromise: Promise<string | null> | null = null;

  private static readonly STORE_DISPLAY_NAME = 'PromoAtlas Product Catalog';

  constructor(strapi: any) {
    this.strapi = strapi;

    // DEBUG: Log environment variable state
    strapi.log.debug(
      `[GeminiFileSearch] Constructor called. GEMINI_API_KEY defined: ${typeof process.env.GEMINI_API_KEY !== 'undefined'}, ` +
      `value length: ${process.env.GEMINI_API_KEY?.length || 0}`
    );

    // Load configuration from environment variables
    this.config = {
      apiKey: process.env.GEMINI_API_KEY || '',
      projectId: process.env.GOOGLE_CLOUD_PROJECT || '',
      projectNumber: process.env.GOOGLE_CLOUD_PROJECT_NUMBER || '',
      storeName: process.env.GEMINI_FILE_SEARCH_STORE_NAME || 'PromoAtlas-RAG',
    };

    // Validate configuration
    if (!this.config.apiKey) {
      strapi.log.error('[GeminiFileSearch] GEMINI_API_KEY is empty or not set!');
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    if (!this.config.projectId) {
      throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required');
    }

    // Initialize Gemini client
    this.ai = new GoogleGenAI({ apiKey: this.config.apiKey });

    // Meilisearch service will be injected in bootstrap
    this.meilisearchService = null;

    strapi.log.info(
      `Gemini File Search service initialized ` +
      `(project: ${this.config.projectId}, data source: Meilisearch)`
    );
  }

  /**
   * Set Meilisearch service (called during bootstrap)
   * 
   * This dependency injection ensures the service reads from Meilisearch
   * instead of making direct Strapi DB queries.
   */
  setMeilisearchService(meilisearchService: any): void {
    this.meilisearchService = meilisearchService;
    this.strapi.log.info('✅ Gemini service connected to Meilisearch');
  }

  /**
   * Get or create the Gemini FileSearchStore
   * 
   * Uses mutex pattern to prevent race conditions when multiple workers
   * try to create the store simultaneously.
   */
  async getOrCreateStore(): Promise<string | null> {
    // Return cached store ID if available
    if (this.storeId) {
      return this.storeId;
    }

    // If creation is already in progress, wait for it (mutex pattern)
    if (this.storeCreationPromise) {
      return this.storeCreationPromise;
    }

    // Start creation and store promise
    this.storeCreationPromise = this._createOrFindStore();

    try {
      const result = await this.storeCreationPromise;
      return result;
    } finally {
      // Clear promise after completion
      this.storeCreationPromise = null;
    }
  }

  /**
   * Internal: Create or find the FileSearchStore
   */
  private async _createOrFindStore(): Promise<string | null> {
    try {
      // List existing stores to find ours
      const storesPager = await this.ai.fileSearchStores.list();

      // Iterate through paginated results using for-await
      let existingStore: any = null;
      for await (const store of storesPager) {
        if (store.displayName === GeminiFileSearchService.STORE_DISPLAY_NAME) {
          existingStore = store;
          break;
        }
      }

      if (existingStore) {
        this.storeId = existingStore.name;
        this.strapi.log.info(`📦 Found existing Gemini FileSearchStore: ${this.storeId}`);
      } else {
        // Create new store
        this.strapi.log.info(
          `📦 Creating new Gemini FileSearchStore: ${GeminiFileSearchService.STORE_DISPLAY_NAME}`
        );
        const newStore = await this.ai.fileSearchStores.create({
          config: {
            displayName: GeminiFileSearchService.STORE_DISPLAY_NAME
          }
        });
        this.storeId = newStore.name;
        this.strapi.log.info(`✅ Created Gemini FileSearchStore: ${this.storeId}`);
      }

      return this.storeId;

    } catch (error: any) {
      this.strapi.log.error('Failed to get/create Gemini FileSearchStore:', error);
      return null;
    }
  }

  /**
   * Transform Meilisearch document to Gemini JSON format
   *
   * Key differences from Meilisearch structure:
   * - Nested multilingual fields (name_en → name.en)
   * - Restructured pricing object
   * - Simplified image URLs
   * - ISO timestamp format
   */
  transformMeilisearchToGemini(
    meilisearchDoc: MeilisearchProductDocument
  ): GeminiProductDocument {
    return {
      id: meilisearchDoc.id,
      sku: meilisearchDoc.sku,
      a_number: meilisearchDoc.a_number,

      // Nest multilingual fields for better AI understanding
      name: {
        en: meilisearchDoc.name_en,
        de: meilisearchDoc.name_de,
        fr: meilisearchDoc.name_fr,
        es: meilisearchDoc.name_es,
      },

      description: {
        en: meilisearchDoc.description_en,
        de: meilisearchDoc.description_de,
        fr: meilisearchDoc.description_fr,
        es: meilisearchDoc.description_es,
      },

      short_description: {
        en: meilisearchDoc.short_description_en,
        de: meilisearchDoc.short_description_de,
        fr: meilisearchDoc.short_description_fr,
        es: meilisearchDoc.short_description_es,
      },

      material: {
        en: meilisearchDoc.material_en,
        de: meilisearchDoc.material_de,
        fr: meilisearchDoc.material_fr,
        es: meilisearchDoc.material_es,
      },

      // Product attributes
      brand: meilisearchDoc.brand,
      supplier: {
        name: meilisearchDoc.supplier_name,
        code: meilisearchDoc.supplier_code,
      },

      // Variant aggregations (already calculated in Meilisearch)
      available_colors: meilisearchDoc.colors || [],
      available_sizes: meilisearchDoc.sizes || [],
      hex_colors: meilisearchDoc.hex_colors || [],
      total_variants: meilisearchDoc.total_variants_count || 0,

      // Pricing (restructured)
      pricing: {
        min: meilisearchDoc.price_min ?? null,
        max: meilisearchDoc.price_max ?? null,
        currency: meilisearchDoc.currency || 'EUR',
      },

      // Product details
      country_of_origin: meilisearchDoc.country_of_origin,
      delivery_time: meilisearchDoc.delivery_time,

      // Images (URLs only - actual images stay in R2)
      images: {
        main: meilisearchDoc.main_image_url,
        thumbnail: meilisearchDoc.main_image_thumbnail_url,
      },

      // Metadata
      is_active: meilisearchDoc.is_active,
      category: meilisearchDoc.category,
      category_codes: meilisearchDoc.category_codes || [],

      // Timestamps (handle both plugin format and custom service format)
      // Plugin uses: updated_at (string), Custom service uses: createdAt/updatedAt (number)
      // Use type assertion to access snake_case fields from plugin
      created_at: (meilisearchDoc as any).created_at
        ? new Date((meilisearchDoc as any).created_at).toISOString()
        : meilisearchDoc.createdAt
          ? new Date(meilisearchDoc.createdAt).toISOString()
          : new Date().toISOString(), // Fallback to current date if missing
      updated_at: (meilisearchDoc as any).updated_at
        ? new Date((meilisearchDoc as any).updated_at).toISOString()
        : meilisearchDoc.updatedAt
          ? new Date(meilisearchDoc.updatedAt).toISOString()
          : new Date().toISOString(), // Fallback to current date if missing
    };
  }

  /**
   * Add or update a single document in Gemini File Search
   *
   * ARCHITECTURE: Reads FROM Meilisearch (not Strapi DB)
   * 
   * This ensures:
   * - Faster sync (Meilisearch already has indexed data)
   * - Data consistency (same format everywhere)
   * - Single source of truth (Meilisearch)
   * 
   * If product not in Meilisearch → skip with warning (don't fail)
   */
  async addOrUpdateDocument(documentId: string): Promise<{ success: boolean; error?: string }> {
    let tempFilePath: string | null = null;

    try {
      // Ensure Meilisearch service is available
      if (!this.meilisearchService) {
        throw new Error(
          'Meilisearch service not initialized. ' +
          'Ensure setMeilisearchService() was called during bootstrap.'
        );
      }

      // Ensure Meilisearch index is initialized
      if (!this.meilisearchService.index) {
        await this.meilisearchService.initializeIndex();
      }

      // Get or create the FileSearchStore
      const storeId = await this.getOrCreateStore();
      if (!storeId) {
        throw new Error('Failed to get or create Gemini FileSearchStore');
      }

      // Fetch document FROM Meilisearch (not Strapi DB)
      // NOTE: Meilisearch uses the Strapi documentId directly as the primary key
      let meilisearchDoc: MeilisearchProductDocument;
      try {
        meilisearchDoc = await this.meilisearchService.index.getDocument(documentId);
        this.strapi.log.debug(`📥 [Gemini] Fetched ${documentId} from Meilisearch`);
      } catch (error) {
        // Product not in Meilisearch → skip (architecture principle: fix Meilisearch first)
        this.strapi.log.warn(
          `⚠️  Skipping Gemini sync for ${documentId}: Not found in Meilisearch. ` +
          `Fix Meilisearch first (architecture principle: "repair Meilisearch before Gemini")`
        );
        return { success: false, error: 'Product not in Meilisearch - skipped' };
      }

      // Transform to Gemini format
      const geminiDoc = this.transformMeilisearchToGemini(meilisearchDoc);

      // NOTE: FileSearchStore doesn't support individual file deletion.
      // Files accumulate but semantic search still returns relevant results.
      // The gemini_file_uri field tracks sync status for each product.

      // Convert to JSON string
      const jsonContent = JSON.stringify(geminiDoc, null, 2);

      // Create temporary file for upload (use SKU for meaningful filename)
      const fileName = `${geminiDoc.sku || documentId}.json`;
      tempFilePath = `/tmp/${fileName}`;

      // Write to temporary file with secure permissions
      const fs = require('fs');
      const os = require('os');
      tempFilePath = require('path').join(os.tmpdir(), fileName);
      fs.writeFileSync(tempFilePath, jsonContent, { mode: 0o600 });

      // Upload file to Gemini FileSearchStore
      const operation = await this.ai.fileSearchStores.uploadToFileSearchStore({
        fileSearchStoreName: storeId,
        file: tempFilePath,
        config: {
          mimeType: 'application/json',
          displayName: `Product ${geminiDoc.sku} (${geminiDoc.a_number})`,
        }
      });

      this.strapi.log.info(
        `✅ Synced product ${geminiDoc.sku} to Gemini File Search (${operation.name})`
      );

      // Save the Gemini file reference to Strapi for tracking
      // Also save the promidata_hash for hash-based deduplication
      try {
        // Fetch product from Strapi to get promidata_hash
        const product = await this.strapi.entityService.findOne('api::product.product', documentId, {
          fields: ['promidata_hash']
        });

        await this.strapi.entityService.update('api::product.product', documentId, {
          data: {
            gemini_file_uri: operation.name,
            gemini_synced_hash: product?.promidata_hash || null,
          },
        });
        this.strapi.log.debug(`📝 Saved gemini_file_uri and gemini_synced_hash for ${geminiDoc.sku}`);
      } catch (updateError) {
        // Non-fatal: file was uploaded, just couldn't update tracking field
        this.strapi.log.warn(`Could not update gemini_file_uri for ${documentId}:`, updateError);
      }

      return { success: true };
    } catch (error) {
      this.strapi.log.error(`Failed to sync product ${documentId} to Gemini:`, error);
      return { success: false, error: error.message || 'Unknown error' };
    } finally {
      // Cleanup temp file (guaranteed execution)
      if (tempFilePath) {
        try {
          const fs = require('fs');
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        } catch (cleanupError) {
          this.strapi.log.warn(`Failed to cleanup temp file ${tempFilePath}:`, cleanupError);
        }
      }
    }
  }

  /**
   * Delete a document from Gemini File Search
   */
  async deleteDocument(documentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // NOTE: FileSearchStore doesn't support individual file deletion.
      // Files remain in the store but we can clear the tracking fields.
      // Next sync will upload a fresh copy (semantic search handles duplicates).

      // Clear both gemini_file_uri and gemini_synced_hash to mark product as needing re-sync
      await this.strapi.entityService.update('api::product.product', documentId, {
        data: {
          gemini_file_uri: null,
          gemini_synced_hash: null,
        },
      });

      this.strapi.log.info(`🗑️  Cleared Gemini sync status for product ${documentId}`);
      return { success: true };
    } catch (error) {
      this.strapi.log.error(`Failed to clear Gemini status for ${documentId}:`, error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Bulk sync from Meilisearch index
   *
   * Iterates through Meilisearch index (not Strapi) and syncs all products.
   * This ensures we sync the exact data that's indexed for search.
   */
  async bulkSyncFromMeilisearch(batchSize: number = 100): Promise<BulkSyncStats> {
    const stats: BulkSyncStats = {
      total: 0,
      synced: 0,
      skipped: 0,
      failed: 0,
      processingTimeMs: 0,
      errors: [],
    };

    const startTime = Date.now();

    try {
      // Ensure Meilisearch service is available
      if (!this.meilisearchService) {
        throw new Error('Meilisearch service not initialized');
      }

      // Ensure Meilisearch index is initialized
      if (!this.meilisearchService.index) {
        await this.meilisearchService.initializeIndex();
      }

      // Get total document count
      const indexStats = await this.meilisearchService.index.getStats();
      stats.total = indexStats.numberOfDocuments || 0;

      this.strapi.log.info(`📦 Starting Gemini bulk sync from Meilisearch (${stats.total} products)`);

      // Fetch documents in batches
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        // Search with empty query to get all documents
        const searchResult = await this.meilisearchService.index.search('', {
          limit: batchSize,
          offset,
        });

        const documents = searchResult.hits as MeilisearchProductDocument[];

        if (documents.length === 0) {
          hasMore = false;
          break;
        }

        this.strapi.log.info(
          `Processing batch: ${offset + 1}-${offset + documents.length} / ${stats.total}`
        );

        // Sync each document
        for (const meilisearchDoc of documents) {
          try {
            const geminiDoc = this.transformMeilisearchToGemini(meilisearchDoc);
            const jsonContent = JSON.stringify(geminiDoc, null, 2);

            // Create temporary file
            const fileName = `product-${meilisearchDoc.id}.json`;
            const tempFilePath = `/tmp/${fileName}`;

            const fs = require('fs');
            fs.writeFileSync(tempFilePath, jsonContent);

            // Upload to Gemini File Search Store
            await this.ai.fileSearchStores.uploadToFileSearchStore({
              fileSearchStoreName: `projects/${this.config.projectNumber}/locations/us-central1/fileSearchStores/${this.config.storeName}`,
              file: tempFilePath,
              config: {
                mimeType: 'application/json',
                displayName: `Product ${geminiDoc.sku} (${geminiDoc.a_number})`,
              }
            });

            // Clean up
            fs.unlinkSync(tempFilePath);

            stats.synced++;
          } catch (error) {
            this.strapi.log.error(`Failed to sync product ${meilisearchDoc.id}:`, error);
            stats.failed++;
            stats.errors.push({
              documentId: meilisearchDoc.id,
              error: error.message || 'Unknown error',
            });
          }
        }

        offset += documents.length;

        // Check if we've processed all documents
        if (offset >= stats.total) {
          hasMore = false;
        }

        // Small delay between batches to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      stats.processingTimeMs = Date.now() - startTime;

      this.strapi.log.info(
        `✅ Gemini bulk sync complete: ${stats.synced}/${stats.total} synced, ` +
        `${stats.skipped} skipped, ${stats.failed} failed, ${stats.processingTimeMs}ms`
      );
    } catch (error) {
      this.strapi.log.error('Gemini bulk sync failed:', error);
      stats.processingTimeMs = Date.now() - startTime;
      throw error;
    }

    return stats;
  }

  /**
   * Get Gemini File Search statistics
   */
  async getStats(): Promise<{ totalFiles: number; totalBytes: number; syncedProducts: number; totalProducts: number }> {
    try {
      // Count products synced to Gemini (have gemini_file_uri set)
      const syncedProducts = await this.strapi.entityService.count('api::product.product', {
        filters: {
          gemini_file_uri: { $notNull: true },
        },
      });

      // Count total products
      const totalProducts = await this.strapi.entityService.count('api::product.product', {});

      // NOTE: FileSearchStore doesn't provide a way to list files or get byte counts.
      // We return synced product count as proxy for file count.
      // Estimated size based on ~2KB per product JSON document.
      const estimatedBytes = syncedProducts * 2048;

      return {
        totalFiles: syncedProducts,  // Each synced product = 1 file in FileSearchStore
        totalBytes: estimatedBytes,  // Estimated size
        syncedProducts,
        totalProducts,
      };
    } catch (error) {
      this.strapi.log.error('Failed to get Gemini stats:', error);
      throw error;
    }
  }

  /**
   * Health check for Gemini API
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check if we can access our FileSearchStore
      const storeId = await this.getOrCreateStore();
      return !!storeId;
    } catch (error) {
      this.strapi.log.error('Gemini health check failed:', error);
      return false;
    }
  }

  /**
   * Get detailed FileSearchStore information
   */
  async getStoreInfo(): Promise<any> {
    try {
      const storeId = await this.getOrCreateStore();

      if (!storeId) {
        return {
          found: false,
          error: 'FileSearchStore not found'
        };
      }

      // Get store details using the FileSearchStore API
      const store = await this.ai.fileSearchStores.get({ name: storeId });

      return {
        found: true,
        storeId,
        displayName: store.displayName,
        name: store.name,
        createTime: store.createTime,
        updateTime: store.updateTime,
        // Return the full store object for any additional properties
        rawStore: store,
      };
    } catch (error) {
      this.strapi.log.error('Failed to get store info:', error);
      throw error;
    }
  }

  /**
   * Test semantic search against FileSearchStore
   */
  async testSemanticSearch(query: string): Promise<any> {
    try {
      const storeId = await this.getOrCreateStore();

      if (!storeId) {
        return {
          success: false,
          error: 'FileSearchStore not found'
        };
      }

      this.strapi.log.info(`[GeminiTest] Testing semantic search: "${query}"`);

      // Construct prompt that explicitly instructs Gemini to search the FileSearchStore
      const searchPrompt = `Search the PromoAtlas product catalog in the FileSearchStore and find products matching: "${query}"

Return ONLY products found in the catalog. For each product, include:
- SKU (product code)
- Product name
- Description
- Any other relevant details (price, color, size, etc.)

If no products match, say "No products found matching your query."`;

      // According to official docs: https://ai.google.dev/gemini-api/docs/file-search
      // Tools MUST be inside config object, and use gemini-2.5-flash for FileSearch support
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: searchPrompt,
        config: {
          tools: [{
            fileSearch: {
              fileSearchStoreNames: [storeId]
            }
          }]
        }
      } as any);

      // Extract response text and metadata
      // Note: Response structure may vary, returning the full response for debugging
      const responseText = response.text || '';

      return {
        success: true,
        query,
        responseText,
        fullResponse: response,  // Include full response for dashboard display
      };
    } catch (error) {
      this.strapi.log.error('Semantic search test failed:', error);
      throw error;
    }
  }

  /**
   * List all FileSearchStores for the project
   * @returns Array of store information
   */
  async listAllStores(): Promise<any[]> {
    try {
      this.strapi.log.info('[GeminiFileSearch] Listing all FileSearchStores');

      // @ts-ignore - API type definitions may be incomplete
      const response: any = await this.ai.fileSearchStores.list({
        pageSize: 100  // Max allowed per page
      } as any);

      const stores = Array.isArray(response) ? response : (response.fileSearchStores || response.items || []);

      this.strapi.log.info(`[GeminiFileSearch] Found ${stores.length} stores`);

      return stores.map((store: any) => ({
        storeId: store.name,
        displayName: store.displayName || 'Unnamed Store',
        createTime: store.createTime,
        updateTime: store.updateTime,
        vectorDatabase: store.vectorDatabase || store.vectorDb || {},
      }));
    } catch (error) {
      this.strapi.log.error('Failed to list FileSearchStores:', error);
      return [];
    }
  }

  /**
   * Create a new FileSearchStore
   * @param displayName - Name for the new store
   * @returns Store information or error
   */
  async createNewStore(displayName: string): Promise<{ success: boolean; storeId?: string; error?: string }> {
    try {
      this.strapi.log.info(`[GeminiFileSearch] Creating new store: ${displayName}`);

      // @ts-ignore - API type definitions may be incomplete
      const response: any = await this.ai.fileSearchStores.create({
        displayName: displayName || `Store ${Date.now()}`
      } as any);

      this.strapi.log.info(`✅ Created store: ${response.name}`);

      return {
        success: true,
        storeId: response.name
      };
    } catch (error) {
      this.strapi.log.error('Failed to create FileSearchStore:', error);
      return {
        success: false,
        error: error.message || 'Failed to create store'
      };
    }
  }

  /**
   * Delete a FileSearchStore
   * @param storeId - ID of store to delete
   * @param force - Force delete even if contains files
   * @returns Success status
   */
  async deleteStoreById(storeId: string, force: boolean = false): Promise<{ success: boolean; error?: string }> {
    try {
      this.strapi.log.info(`[GeminiFileSearch] Deleting store: ${storeId} (force: ${force})`);

      // @ts-ignore - API type definitions may be incomplete
      await this.ai.fileSearchStores.delete({
        name: storeId,
        force
      } as any);

      this.strapi.log.info(`✅ Deleted store: ${storeId}`);

      return { success: true };
    } catch (error) {
      this.strapi.log.error('Failed to delete FileSearchStore:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete store'
      };
    }
  }

  /**
   * Get detailed statistics including active/pending/failed document counts
   * @returns Detailed statistics object
   */
  async getDetailedStats(): Promise<any> {
    try {
      const storeId = await this.getOrCreateStore();

      if (!storeId) {
        return {
          success: false,
          error: 'FileSearchStore not found'
        };
      }

      // Get store details which include vector database stats
      const storeResponse: any = await this.ai.fileSearchStores.get({ name: storeId });

      // Extract document counts (returned as strings, need to parse)
      const activeDocuments = parseInt(storeResponse.activeDocumentsCount || '0', 10);
      const pendingDocuments = parseInt(storeResponse.pendingDocumentsCount || '0', 10);
      const failedDocuments = parseInt(storeResponse.failedDocumentsCount || '0', 10);
      const totalBytes = parseInt(storeResponse.sizeBytes || '0', 10);

      // Count synced products from Strapi
      const syncedProducts = await this.strapi.entityService.count('api::product.product', {
        filters: { gemini_file_uri: { $notNull: true } }
      });

      const totalProducts = await this.strapi.entityService.count('api::product.product', {});

      return {
        success: true,
        stats: {
          // Document counts from FileSearchStore API (note: counts include all files, not just active)
          activeDocuments,
          pendingDocuments,
          failedDocuments,
          totalDocuments: activeDocuments + pendingDocuments + failedDocuments,

          // Product sync counts from Strapi
          syncedProducts,
          totalProducts,
          coverage: totalProducts > 0 ? Math.round((syncedProducts / totalProducts) * 100) : 0,

          // Size information
          totalBytes,

          // Store metadata
          storeId,
          displayName: storeResponse.displayName,
          createTime: storeResponse.createTime,
          updateTime: storeResponse.updateTime,
        }
      };
    } catch (error) {
      this.strapi.log.error('Failed to get detailed stats:', error);
      return {
        success: false,
        error: error.message || 'Failed to get detailed stats'
      };
    }
  }

  /**
   * Get recent search history
   * Note: This is a placeholder - actual implementation would require database storage
   * @returns Array of recent searches
   */
  async getSearchHistory(limit: number = 10): Promise<any[]> {
    // TODO: Implement search history tracking in database
    // For now, return empty array
    this.strapi.log.info('[GeminiFileSearch] Search history not yet implemented');
    return [];
  }
}

/**
 * Factory function to create Gemini File Search service instance
 */
export default ({ strapi }: { strapi: any }) => {
  return new GeminiFileSearchService(strapi);
};
