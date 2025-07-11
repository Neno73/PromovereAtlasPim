/**
 * Promidata Sync Service
 * Core service for synchronizing products from Promidata API
 */

import { factories } from '@strapi/strapi';
import crypto from 'crypto';

// Use node-fetch for API calls
import fetch from 'node-fetch';

export default factories.createCoreService('api::promidata-sync.promidata-sync', ({ strapi }) => ({
  
  /**
   * Promidata API configuration
   */
  promidataConfig: {
    baseUrl: 'https://promi-dl.de/Profiles/Live/849c892e-b443-4f49-be3a-61a351cbdd23',
    endpoints: {
      suppliers: '/Import/Import.txt',
      categories: '/Import/CAT.csv',
      // Products endpoint returns JSON with hash in URL format: file.json|hash
      products: (supplierCode: string) => `/${supplierCode}/${supplierCode}-100804.json`,
      // Individual product data with hash will be parsed from the products response
    }
  },

  /**
   * Fetch suppliers list from Promidata
   */
  async fetchSuppliersFromPromidata() {
    try {
      const response = await fetch(`${this.promidataConfig.baseUrl}${this.promidataConfig.endpoints.suppliers}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch suppliers: ${response.statusText}`);
      }
      
      const text = await response.text();
      const suppliers = text.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [code, name] = line.split('\t');
          return { code: code?.trim(), name: name?.trim() };
        })
        .filter(supplier => supplier.code && supplier.name);
      
      strapi.log.info(`Fetched ${suppliers.length} suppliers from Promidata`);
      return suppliers;
    } catch (error) {
      strapi.log.error('Failed to fetch suppliers from Promidata:', error);
      throw error;
    }
  },

  /**
   * Fetch categories from CAT.csv
   */
  async fetchCategoriesFromPromidata() {
    try {
      const response = await fetch(`${this.promidataConfig.baseUrl}${this.promidataConfig.endpoints.categories}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch categories: ${response.statusText}`);
      }
      
      const text = await response.text();
      const lines = text.split('\n').filter(line => line.trim());
      const categories = [];
      
      for (let i = 1; i < lines.length; i++) { // Skip header
        const [code, name, parentCode] = lines[i].split(';');
        if (code && name) {
          categories.push({
            code: code.trim(),
            name: name.trim(),
            parent_code: parentCode?.trim() || null
          });
        }
      }
      
      strapi.log.info(`Fetched ${categories.length} categories from Promidata`);
      return categories;
    } catch (error) {
      strapi.log.error('Failed to fetch categories from Promidata:', error);
      throw error;
    }
  },

  /**
   * Parse product URLs with hashes from Promidata Import.txt for a specific supplier
   * Expected format in Import.txt: URLs like "https://promi-dl.de/Profiles/Live/849c892e-b443-4f49-be3a-61a351cbdd23/A23/A23-100804.json|751159B8B70A7230BA6701227C1C5C63F9F2D108"
   */
  async parseProductUrlsWithHashes(supplierCode: string): Promise<Array<{url: string, hash: string}>> {
    try {
      // Get the complete Import.txt file that contains all product URLs with hashes
      const importUrl = 'https://promidatabase.s3.eu-central-1.amazonaws.com/Profiles/Live/849c892e-b443-4f49-be3a-61a351cbdd23/Import/Import.txt';
      const response = await fetch(importUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch Import.txt: ${response.statusText}`);
      }
      
      const text = await response.text();
      const productUrlsWithHashes = [];
      
      // Parse the response and filter for the specific supplier
      const lines = text.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        // Skip the CAT.csv line and only process product lines
        if (line.includes('CAT.csv')) {
          continue;
        }
        
        if (line.includes('|') && line.includes(`/${supplierCode}/`)) {
          const [fullUrlPart, hash] = line.split('|');
          if (fullUrlPart && hash) {
            // The fullUrlPart already contains the complete URL, just clean it
            const cleanUrl = fullUrlPart.trim();
            productUrlsWithHashes.push({
              url: cleanUrl,
              hash: hash.trim()
            });
          }
        }
      }
      
      strapi.log.info(`Found ${productUrlsWithHashes.length} product URLs with hashes for supplier ${supplierCode}`);
      return productUrlsWithHashes;
    } catch (error) {
      strapi.log.error(`Failed to parse product URLs for supplier ${supplierCode}:`, error);
      return [];
    }
  },

  /**
   * Fetch individual product data from clean URL (without hash)
   */
  async fetchProductData(productUrl: string): Promise<any> {
    try {
      const response = await fetch(productUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch product from ${productUrl}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      strapi.log.error(`Failed to fetch product data from ${productUrl}:`, error);
      throw error;
    }
  },

  /**
   * Fetch products for a supplier
   */
  async fetchProductsFromPromidata(supplierCode: string) {
    try {
      const response = await fetch(`${this.promidataConfig.baseUrl}${this.promidataConfig.endpoints.products(supplierCode)}`);
      if (!response.ok) {
        if (response.status === 404) {
          return []; // No products for this supplier
        }
        throw new Error(`Failed to fetch products for ${supplierCode}: ${response.statusText}`);
      }
      
      const jsonData = await response.json() as any;
      
      // Handle different JSON structures
      let products = [];
      if (Array.isArray(jsonData)) {
        products = jsonData;
      } else if (jsonData.products && Array.isArray(jsonData.products)) {
        products = jsonData.products;
      } else if (jsonData.data && Array.isArray(jsonData.data)) {
        products = jsonData.data;
      } else if (typeof jsonData === 'object') {
        // If it's an object with product properties, convert to array
        products = Object.values(jsonData).filter(item => 
          typeof item === 'object' && item !== null
        );
      }
      
      // Log first product structure for debugging
      if (products.length > 0) {
        strapi.log.info(`First product keys: ${Object.keys(products[0]).join(', ')}`);
      }
      
      strapi.log.info(`Fetched ${products.length} products for supplier ${supplierCode}`);
      return products;
    } catch (error) {
      strapi.log.error(`Failed to fetch products for supplier ${supplierCode}:`, error);
      throw error;
    }
  },

  /**
   * Import categories into Strapi
   */
  async importCategories() {
    try {
      const categories = await this.fetchCategoriesFromPromidata();
      const imported = [];
      const errors = [];

      // Create categories in hierarchy order (parents first)
      const categoriesByParent = new Map();
      categories.forEach(cat => {
        const parentCode = cat.parent_code || 'root';
        if (!categoriesByParent.has(parentCode)) {
          categoriesByParent.set(parentCode, []);
        }
        categoriesByParent.get(parentCode).push(cat);
      });

      // Import root categories first
      if (categoriesByParent.has('root')) {
        for (const category of categoriesByParent.get('root')) {
          try {
            await this.createOrUpdateCategory(category);
            imported.push(category.code);
          } catch (error) {
            errors.push({ category: category.code, error: error.message });
          }
        }
      }

      // Then import child categories
      for (const [parentCode, children] of categoriesByParent) {
        if (parentCode === 'root') continue;
        
        for (const category of children) {
          try {
            await this.createOrUpdateCategory(category);
            imported.push(category.code);
          } catch (error) {
            errors.push({ category: category.code, error: error.message });
          }
        }
      }

      return {
        total: categories.length,
        imported: imported.length,
        errors: errors.length,
        errorDetails: errors
      };
    } catch (error) {
      strapi.log.error('Category import failed:', error);
      throw error;
    }
  },

  /**
   * Create or update a category
   */
  async createOrUpdateCategory(categoryData: any) {
    try {
      // Check if category exists
      const existing = await strapi.entityService.findMany('api::category.category', {
        filters: { code: categoryData.code }
      });

      const data = {
        code: categoryData.code,
        name: categoryData.name,
        parent_code: categoryData.parent_code
      };

      if (existing.length > 0) {
        // Update existing
        return await strapi.entityService.update('api::category.category', existing[0].id, { data });
      } else {
        // Create new
        return await strapi.entityService.create('api::category.category', { data });
      }
    } catch (error) {
      strapi.log.error(`Failed to create/update category ${categoryData.code}:`, error);
      throw error;
    }
  },

  /**
   * Start sync process
   */
  async startSync(supplierId?: string) {
    try {
      const suppliers = supplierId 
        ? await strapi.entityService.findMany('api::supplier.supplier', {
            filters: { id: supplierId, is_active: true }
          })
        : await strapi.entityService.findMany('api::supplier.supplier', {
            filters: { is_active: true, auto_import: true }
          });

      const results = [];

      for (const supplier of suppliers) {
        try {
          const result = await this.syncSupplier(supplier);
          results.push({
            supplier: supplier.code,
            success: true,
            ...result
          });
        } catch (error) {
          results.push({
            supplier: supplier.code,
            success: false,
            error: error.message
          });
        }
      }

      return {
        suppliersProcessed: suppliers.length,
        results
      };
    } catch (error) {
      strapi.log.error('Sync process failed:', error);
      throw error;
    }
  },

  /**
   * Sync a single supplier using product-level hash comparison
   */
  async syncSupplier(supplier: any) {
    try {
      strapi.log.info(`Starting sync for supplier: ${supplier.code}`);

      // Get product URLs with hashes from Promidata
      const productUrlsWithHashes = await this.parseProductUrlsWithHashes(supplier.code);
      if (!productUrlsWithHashes || productUrlsWithHashes.length === 0) {
        return { message: 'No products available for this supplier' };
      }

      // Get existing products for this supplier from database
      const existingProducts = await strapi.entityService.findMany('api::product.product', {
        filters: { supplier: supplier.id },
        fields: ['id', 'sku', 'promidata_hash', 'last_synced']
      });

      // Create a map for quick lookup of existing products
      const existingProductsMap = new Map();
      existingProducts.forEach(product => {
        existingProductsMap.set(product.sku, product);
      });

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      const errors = [];

      // Process each product URL individually (limit to 5 for testing)
      const testLimit = 5;
      const productsToProcess = productUrlsWithHashes.slice(0, testLimit);
      strapi.log.info(`Processing ${productsToProcess.length} products (limited to ${testLimit} for testing)`);
      
      for (const { url, hash } of productsToProcess) {
        try {
          // First, check if we need to fetch this product by looking at existing hashes
          // Extract product code from URL to find existing product
          const urlParts = url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          const productCode = fileName.replace('.json', '');
          
          const existingProduct = existingProductsMap.get(productCode);
          
          // Check if product needs updating based on hash
          if (existingProduct && existingProduct.promidata_hash === hash) {
            skipped++;
            strapi.log.debug(`Product ${productCode} unchanged (hash: ${hash}), skipping`);
            continue;
          }

          // Fetch the actual product data using the clean URL
          strapi.log.debug(`Fetching product data from: ${url}`);
          const productData = await this.fetchProductData(url);
          
          // Create or update product
          const result = await this.createOrUpdateProduct(productData, supplier, hash, url);
          if (result.created) {
            imported++;
            strapi.log.debug(`Product ${productCode} created with hash: ${hash}`);
          } else {
            updated++;
            strapi.log.debug(`Product ${productCode} updated with hash: ${hash}`);
          }

        } catch (error) {
          const urlParts = url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          const productCode = fileName.replace('.json', '');
          
          errors.push({
            productCode: productCode || 'unknown',
            url: url,
            error: error.message
          });
          strapi.log.error(`Error processing product ${productCode}:`, error.message);
        }
      }

      strapi.log.info(`Sync completed for supplier: ${supplier.code} - Imported: ${imported}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors.length}`);
      return {
        message: 'Sync completed successfully',
        productsProcessed: productsToProcess.length,
        imported,
        updated,
        skipped,
        errors: errors.length,
        errorDetails: errors
      };
    } catch (error) {
      strapi.log.error(`Sync failed for supplier ${supplier.code}:`, error);
      throw error;
    }
  },

  /**
   * Import products for a supplier
   */
  async importProducts(products: any[], supplier: any) {
    const imported = [];
    const updated = [];
    const errors = [];

    for (const productData of products) {
      try {
        // Generate hash for the product
        const productString = JSON.stringify(productData);
        const hash = require('crypto').createHash('md5').update(productString).digest('hex');
        
        const result = await this.createOrUpdateProduct(productData, supplier, hash);
        if (result.created) {
          imported.push(result.product.id);
        } else {
          updated.push(result.product.id);
        }
      } catch (error) {
        errors.push({
          productCode: productData.code || productData.id,
          error: error.message
        });
      }
    }

    return {
      imported: imported.length,
      updated: updated.length,
      errors: errors.length,
      errorDetails: errors
    };
  },

  /**
   * Extract product code from product data
   * For Promidata structure, the product code is typically in the URL filename
   */
  extractProductCode(productData: any, supplier: any, url?: string): string | null {
    // For Promidata, try to extract from URL first since the JSON structure doesn't have a simple SKU field
    if (url) {
      const urlParts = url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const productCode = fileName.replace('.json', '');
      if (productCode) {
        return productCode;
      }
    }
    
    // Fallback to checking various possible fields in the JSON
    return productData.articlenumber || productData.sku_supplier || productData.SKU || 
           productData.Code || productData.code || productData.id || productData.sku ||
           productData.ProductCode || productData.ItemCode || productData.ArtNr || null;
  },

  /**
   * Create or update a product with hash tracking
   */
  async createOrUpdateProduct(productData: any, supplier: any, hash: string, url?: string) {
    try {
      const productCode = this.extractProductCode(productData, supplier, url);
      if (!productCode) {
        throw new Error('No valid product code found');
      }

      // Check if product exists
      const existing = await strapi.entityService.findMany('api::product.product', {
        filters: { 
          sku: productCode,
          supplier: supplier.id 
        }
      });
      
      // Extract product name from Promidata structure (multilingual JSON)
      const nameJson: any = {};
      if (productData.ChildProducts && productData.ChildProducts[0] && productData.ChildProducts[0].ProductDetails) {
        const details = productData.ChildProducts[0].ProductDetails;
        if (details['en'] && details['en'].Name) nameJson['en'] = details['en'].Name;
        if (details['de'] && details['de'].Name) nameJson['de'] = details['de'].Name;
        if (details['fr'] && details['fr'].Name) nameJson['fr'] = details['fr'].Name;
        if (details['nl'] && details['nl'].Name) nameJson['nl'] = details['nl'].Name;
      }
      
      // Extract description from Promidata structure (multilingual JSON)
      const descriptionJson: any = {};
      if (productData.ChildProducts && productData.ChildProducts[0] && productData.ChildProducts[0].ProductDetails) {
        const details = productData.ChildProducts[0].ProductDetails;
        if (details['en'] && details['en'].Description) descriptionJson['en'] = details['en'].Description;
        if (details['de'] && details['de'].Description) descriptionJson['de'] = details['de'].Description;
        if (details['fr'] && details['fr'].Description) descriptionJson['fr'] = details['fr'].Description;
        if (details['nl'] && details['nl'].Description) descriptionJson['nl'] = details['nl'].Description;
      }
      
      // Extract price from Promidata structure
      let productPrice = null;
      if (productData.ChildProducts && productData.ChildProducts[0] && productData.ChildProducts[0].ProductPriceCountryBased) {
        const priceData = productData.ChildProducts[0].ProductPriceCountryBased;
        // Try to get BENELUX price first, then other regions
        const region = priceData.BENELUX || Object.values(priceData)[0];
        if (region && region.GeneralBuyingPrice && region.GeneralBuyingPrice[0]) {
          productPrice = region.GeneralBuyingPrice[0].Price;
        }
      }
      
      // Extract weight from Promidata structure
      let weightValue = null;
      if (productData.ChildProducts && productData.ChildProducts[0] && productData.ChildProducts[0].NonLanguageDependedProductDetails) {
        const details = productData.ChildProducts[0].NonLanguageDependedProductDetails;
        if (details.Weight) {
          weightValue = details.Weight; // Weight is already in grams in Promidata
        }
      }
      
      // Extract additional fields from Promidata structure
      let categoryValue = null;
      let dimensionsValue = null;
      if (productData.ChildProducts && productData.ChildProducts[0] && productData.ChildProducts[0].NonLanguageDependedProductDetails) {
        const details = productData.ChildProducts[0].NonLanguageDependedProductDetails;
        categoryValue = details.Category;
        if (details.DimensionsLength || details.DimensionsWidth || details.DimensionsHeight) {
          dimensionsValue = `${details.DimensionsLength || 0} x ${details.DimensionsWidth || 0} x ${details.DimensionsHeight || 0} mm`;
        }
      }

      const data = {
        sku: productCode,
        name: nameJson,
        description: descriptionJson,
        supplier: supplier.id,
        price_tiers: productPrice ? [{ quantity: 1, price: parseFloat(productPrice) }] : [],
        weight: weightValue,
        dimension: dimensionsValue,
        main_category: categoryValue,
        promidata_hash: hash,
        last_synced: new Date().toISOString(),
        is_active: true
      };

      if (existing.length > 0) {
        // Update existing
        const product = await strapi.entityService.update('api::product.product', existing[0].id, { data });
        return { product, created: false };
      } else {
        // Create new
        const product = await strapi.entityService.create('api::product.product', { data });
        return { product, created: true };
      }
    } catch (error) {
      strapi.log.error(`Failed to create/update product ${this.extractProductCode(productData, supplier, url)}:`, error);
      throw error;
    }
  },

  /**
   * Update sync configuration
   */
  async updateSyncConfiguration(supplier: any, hash: string) {
    try {
      const existing = await strapi.entityService.findMany('api::sync-configuration.sync-configuration', {
        filters: { supplier: supplier.id }
      });

      const data = {
        supplier: supplier.id,
        last_hash: hash,
        last_sync: new Date().toISOString(),
        sync_status: 'completed' as const
      };

      if (existing.length > 0) {
        await strapi.entityService.update('api::sync-configuration.sync-configuration', existing[0].id, { data });
      } else {
        await strapi.entityService.create('api::sync-configuration.sync-configuration', { data });
      }
    } catch (error) {
      strapi.log.error(`Failed to update sync configuration for supplier ${supplier.code}:`, error);
      throw error;
    }
  },

  /**
   * Get sync status for all suppliers
   */
  async getSyncStatus() {
    try {
      const suppliers = await strapi.entityService.findMany('api::supplier.supplier', {
        filters: { is_active: true },
        populate: ['sync_config']
      });

      return suppliers.map((supplier: any) => ({
        id: supplier.id,
        code: supplier.code,
        name: supplier.name,
        auto_import: supplier.auto_import,
        last_sync: supplier.last_sync_date || null,
        last_hash: supplier.last_hash || null,
        sync_status: supplier.last_sync_status || 'never'
      }));
    } catch (error) {
      strapi.log.error('Failed to get sync status:', error);
      throw error;
    }
  },

  /**
   * Get sync history
   */
  async getSyncHistory(params: { page: number; pageSize: number }) {
    try {
      // This would require a sync log table in a full implementation
      // For now, return sync configurations as history
      return await strapi.entityService.findMany('api::sync-configuration.sync-configuration', {
        sort: { last_sync: 'desc' },
        pagination: {
          page: params.page,
          pageSize: params.pageSize
        },
        populate: ['supplier']
      });
    } catch (error) {
      strapi.log.error('Failed to get sync history:', error);
      throw error;
    }
  },

  /**
   * Test connection to Promidata API
   */
  async testConnection() {
    try {
      const suppliers = await this.fetchSuppliersFromPromidata();
      return {
        status: 'success',
        suppliersFound: suppliers.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}));