/**
 * Gemini File Search Service
 *
 * Handles synchronization of products to Google Gemini File Search for AI-powered RAG:
 * - Reads transformed documents FROM Meilisearch (not Strapi)
 * - Converts Meilisearch documents to Gemini-compatible JSON
 * - Uploads to Gemini File Search for semantic search
 * - Bulk sync from Meilisearch index for initial indexing
 *
 * Architecture Principle: "Always repair Meilisearch before repairing Gemini"
 * - Meilisearch is source of truth for flattened, aggregated product data
 * - If product not in Meilisearch → skip Gemini sync (don't fail)
 *
 * @module GeminiFileSearchService
 */

import { GoogleGenAI } from '@google/genai';
import type { MeilisearchProductDocument } from '../api/product/services/meilisearch-types';

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
 */
export class GeminiFileSearchService {
  private ai: GoogleGenAI;
  private config: GeminiConfig;
  private strapi: any;
  private meilisearchService: any;

  constructor(strapi: any) {
    this.strapi = strapi;

    // Load configuration from environment variables
    this.config = {
      apiKey: process.env.GEMINI_API_KEY || '',
      projectId: process.env.GOOGLE_CLOUD_PROJECT || '',
      projectNumber: process.env.GOOGLE_CLOUD_PROJECT_NUMBER || '',
      storeName: process.env.GEMINI_FILE_SEARCH_STORE_NAME || 'Atlas-Rag',
    };

    // Validate configuration
    if (!this.config.apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    if (!this.config.projectId) {
      throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required');
    }

    // Initialize Gemini client
    this.ai = new GoogleGenAI({ apiKey: this.config.apiKey });

    // Get Meilisearch service (will be injected in bootstrap)
    this.meilisearchService = null;

    strapi.log.info(`Gemini File Search service initialized for project: ${this.config.projectId}`);
  }

  /**
   * Set Meilisearch service (called during bootstrap)
   */
  setMeilisearchService(meilisearchService: any): void {
    this.meilisearchService = meilisearchService;
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

      // Timestamps (convert Unix timestamp to ISO string)
      created_at: new Date(meilisearchDoc.createdAt).toISOString(),
      updated_at: new Date(meilisearchDoc.updatedAt).toISOString(),
    };
  }

  /**
   * Add or update a single document in Gemini File Search
   *
   * Architecture: Reads FROM Meilisearch (not Strapi)
   * - If product not in Meilisearch → skip with warning (don't fail)
   * - This ensures Meilisearch is always source of truth
   */
  async addOrUpdateDocument(documentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Ensure Meilisearch service is available
      if (!this.meilisearchService) {
        throw new Error('Meilisearch service not initialized');
      }

      // Ensure Meilisearch index is initialized
      if (!this.meilisearchService.index) {
        await this.meilisearchService.initializeIndex();
      }

      // Fetch document FROM Meilisearch (not Strapi)
      let meilisearchDoc: MeilisearchProductDocument;
      try {
        meilisearchDoc = await this.meilisearchService.index.getDocument(documentId);
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

      // Convert to JSON string
      const jsonContent = JSON.stringify(geminiDoc, null, 2);

      // Create temporary file for upload
      const fileName = `product-${documentId}.json`;
      const tempFilePath = `/tmp/${fileName}`;

      // Write to temporary file
      const fs = require('fs');
      fs.writeFileSync(tempFilePath, jsonContent);

      // Upload file to Gemini File Search Store (indefinite persistence)
      const operation = await this.ai.fileSearchStores.uploadToFileSearchStore({
        fileSearchStoreName: `projects/${this.config.projectNumber}/locations/us-central1/fileSearchStores/${this.config.storeName}`,
        file: tempFilePath,
        config: {
          mimeType: 'application/json',
          displayName: `Product ${geminiDoc.sku} (${geminiDoc.a_number})`,
        }
      });

      // Clean up temporary file
      fs.unlinkSync(tempFilePath);

      this.strapi.log.info(
        `✅ Synced product ${geminiDoc.sku} to Gemini File Search (${operation.name})`
      );

      return { success: true };
    } catch (error) {
      this.strapi.log.error(`Failed to sync product ${documentId} to Gemini:`, error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Delete a document from Gemini File Search
   */
  async deleteDocument(documentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // List files to find the one to delete
      const pager = await this.ai.files.list();
      let fileToDelete = null;

      // Iterate through pager to find file with matching documentId in displayName
      for await (const file of pager) {
        if (file.displayName?.includes(documentId)) {
          fileToDelete = file;
          break;
        }
      }

      if (!fileToDelete) {
        this.strapi.log.warn(`Product ${documentId} not found in Gemini File Search`);
        return { success: false, error: 'File not found' };
      }

      // Delete file using its name
      await this.ai.files.delete({ name: fileToDelete.name });

      this.strapi.log.info(`🗑️  Deleted product ${documentId} from Gemini File Search`);
      return { success: true };
    } catch (error) {
      this.strapi.log.error(`Failed to delete product ${documentId} from Gemini:`, error);
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
  async getStats(): Promise<{ totalFiles: number; totalBytes: number }> {
    try {
      const pager = await this.ai.files.list();
      let totalFiles = 0;
      let totalBytes = 0;

      // Iterate through all files to count and sum sizes
      for await (const file of pager) {
        totalFiles++;
        const sizeBytes = typeof file.sizeBytes === 'string'
          ? parseInt(file.sizeBytes, 10)
          : (file.sizeBytes || 0);
        totalBytes += sizeBytes;
      }

      return { totalFiles, totalBytes };
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
      // Simple test: list files (just create pager, don't iterate)
      await this.ai.files.list();
      return true;
    } catch (error) {
      this.strapi.log.error('Gemini health check failed:', error);
      return false;
    }
  }
}

/**
 * Factory function to create Gemini File Search service instance
 */
export default ({ strapi }: { strapi: any }) => {
  return new GeminiFileSearchService(strapi);
};
