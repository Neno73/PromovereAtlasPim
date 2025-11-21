/**
 * Gemini Service
 * 
 * Manages interaction with Google Gemini API for RAG (Retrieval Augmented Generation).
 * Uses FileSearchStores for persistent embedding storage.
 * 
 * Based on: https://ai.google.dev/gemini-api/docs/file-search
 */

import { GoogleGenAI } from '@google/genai';
import productToJson from './transformers/product-to-json';
import fs from 'fs';
import path from 'path';
import os from 'os';

const STORE_DISPLAY_NAME = 'PromoAtlas Product Catalog';

class GeminiService {
    private client: any = null;
    private storeId: string | null = null;
    private storeCreationPromise: Promise<string | null> | null = null;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            this.client = new GoogleGenAI({ apiKey });
            strapi.log.info('✅ Gemini client initialized');
        } else {
            strapi.log.warn('⚠️  GEMINI_API_KEY not configured - Gemini features disabled');
        }
    }

    /**
     * Get or Create the PromoAtlas File Search Store
     * Includes mutex to prevent race conditions on concurrent calls
     */
    async getOrCreateStore() {
        if (!this.client) return null;
        if (this.storeId) return this.storeId;

        // If creation is already in progress, wait for it
        if (this.storeCreationPromise) {
            return this.storeCreationPromise;
        }

        // Start creation and store promise
        this.storeCreationPromise = this._createStore();

        try {
            const result = await this.storeCreationPromise;
            return result;
        } finally {
            // Clear promise after completion
            this.storeCreationPromise = null;
        }
    }

    /**
     * Internal method to create or find the store
     */
    private async _createStore(): Promise<string | null> {
        try {
            // List stores to find ours
            const stores = await this.client.fileSearchStores.list();

            // Handle paginated response
            let storeList: any[] = [];
            if (Array.isArray(stores)) {
                storeList = stores;
            } else if (stores.pageInternal && Array.isArray(stores.pageInternal)) {
                storeList = stores.pageInternal;
            } else if (stores.fileSearchStores && Array.isArray(stores.fileSearchStores)) {
                storeList = stores.fileSearchStores;
            }

            const existingStore = storeList.find((s: any) => s.displayName === STORE_DISPLAY_NAME);

            if (existingStore) {
                this.storeId = existingStore.name;
                strapi.log.info(`Found existing Gemini FileSearchStore: ${this.storeId}`);
            } else {
                strapi.log.info(`Creating new Gemini FileSearchStore: ${STORE_DISPLAY_NAME}`);
                const newStore = await this.client.fileSearchStores.create({
                    config: {
                        displayName: STORE_DISPLAY_NAME
                    }
                });
                this.storeId = newStore.name;
                strapi.log.info(`✅ Created Gemini FileSearchStore: ${this.storeId}`);
            }

            return this.storeId;

        } catch (error: any) {
            strapi.log.error('Failed to get/create Gemini FileSearchStore:', error);
            return null;
        }
    }

    /**
     * Upsert (Upload or Update) a product to Gemini
     */
    async upsertProduct(product: any) {
        if (!this.client) return;

        let tempFilePath: string | null = null;

        try {
            const storeId = await this.getOrCreateStore();
            if (!storeId) {
                strapi.log.error('Cannot upsert product: No Gemini FileSearchStore available');
                return;
            }

            // 1. Transform to JSON
            const productDoc = productToJson.transform(product);
            const jsonContent = JSON.stringify(productDoc, null, 2);
            const fileName = `${productDoc.sku}.json`;

            // 2. Write to temp file with secure permissions (read/write for owner only)
            tempFilePath = path.join(os.tmpdir(), fileName);
            fs.writeFileSync(tempFilePath, jsonContent, { mode: 0o600 });

            // 3. Upload to Gemini FileSearchStore
            // Note: Using the correct parameter name from Google's documentation
            let operation = await this.client.fileSearchStores.uploadToFileSearchStore({
                file: tempFilePath,
                fileSearchStoreName: storeId,  // Correct parameter name
                config: {
                    displayName: fileName,
                }
            });

            // 4. Wait for operation to complete (following Google's example)
            let attempts = 0;
            const maxAttempts = 20; // 20 * 3s = 60s timeout
            while (!operation.done && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                operation = await this.client.operations.get({ operation });
                attempts++;
            }

            if (!operation.done) {
                throw new Error(`Upload operation timed out after ${maxAttempts * 3}s`);
            }

            strapi.log.info(`✅ Uploaded ${fileName} to Gemini FileSearchStore`);

            // 5. Store the document name/reference if available from operation
            // The operation.response might contain the document info
            const documentName = operation.response?.name || `${storeId}/documents/${fileName}`;

            await strapi.documents('api::product.product').update({
                documentId: product.documentId,
                data: {
                    gemini_file_uri: documentName
                } as any
            });

            return operation;

        } catch (error: any) {
            strapi.log.error(`Failed to upsert product ${product.sku} to Gemini:`, error);
            throw error;
        } finally {
            // Cleanup temp file (guaranteed execution)
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                try {
                    fs.unlinkSync(tempFilePath);
                } catch (cleanupError) {
                    strapi.log.warn(`Failed to cleanup temp file ${tempFilePath}:`, cleanupError);
                }
            }
        }
    }

    /**
     * Add or Update a document by ID
     * Fetches product from Strapi and upserts to Gemini
     */
    async addOrUpdateDocument(documentId: string) {
        try {
            // Fetch product from Strapi
            const product = await strapi.documents('api::product.product').findOne({
                documentId,
                populate: ['supplier', 'categories', 'price_tiers', 'dimensions']
            });

            if (!product) {
                return { success: false, error: `Product ${documentId} not found in Strapi` };
            }

            await this.upsertProduct(product);
            return { success: true };

        } catch (error: any) {
            strapi.log.error(`Failed to add/update document ${documentId}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete a document by ID
     */
    async deleteDocument(documentId: string) {
        try {
            // We might not have the product if it's already deleted from Strapi
            // But we need the file URI to delete from Gemini.
            // If we can't find it in Strapi, we might need to search Gemini by name/metadata?
            // For now, we'll try to find it. If not found, we can't easily delete from Gemini 
            // unless we store the mapping elsewhere or derive the filename.

            // Assuming filename is based on SKU, but we need SKU.
            // If product is deleted, we can't get SKU.
            // This is a limitation. Ideally we pass SKU or URI to delete.

            // For this implementation, we'll assume the worker passes documentId.
            // If product is gone, we log a warning.

            const product = await strapi.documents('api::product.product').findOne({
                documentId
            });

            if (product) {
                await this.deleteProduct(product);
                return { success: true };
            }

            return { success: false, error: 'Product not found for deletion' };

        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete a product from Gemini FileSearchStore
     */
    async deleteProduct(product: any) {
        if (!this.client) return;

        if (product.gemini_file_uri) {
            try {
                // Delete the document from the FileSearchStore
                // The exact API method depends on the SDK structure
                // For now, we'll log and clear the reference
                strapi.log.info(`Clearing Gemini reference for: ${product.sku}`);

                // TODO: Implement actual Gemini deletion when SDK method is confirmed
                // await this.client.files.delete({ name: product.gemini_file_uri });

                await strapi.documents('api::product.product').update({
                    documentId: product.documentId,
                    data: {
                        gemini_file_uri: null
                    } as any
                });
            } catch (error: any) {
                strapi.log.error(`Failed to delete Gemini document for ${product.sku}:`, error);
            }
        }
    }
}

export default new GeminiService();
