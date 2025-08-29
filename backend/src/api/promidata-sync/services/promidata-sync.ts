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

      // Process all product URLs for production import
      strapi.log.info(`Found ${productUrlsWithHashes.length} products for supplier ${supplier.code}`);
      
      const productsToProcess = productUrlsWithHashes; // Process all products
      strapi.log.info(`Processing ${productsToProcess.length} products for ${supplier.code}`);
      if (productsToProcess.length === 0) {
        strapi.log.error('No products to process!');
        return { message: 'No products found to process' };
      }
      
      strapi.log.info(`Products to process: ${productsToProcess.map(p => p.url.split('/').pop()).join(', ')}`);
      
      strapi.log.info('About to start product processing loop...');
      for (const { url, hash } of productsToProcess) {
        try {
          strapi.log.info(`Processing URL: ${url}`);
          
          // Extract product code from URL to find existing product
          const urlParts = url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          const productCode = fileName.replace('.json', '');
          
          strapi.log.info(`Product code: ${productCode}`);
          
          // Fetch the actual product data first to check child products
          strapi.log.info(`Fetching product data from: ${url}`);
          const productData = await this.fetchProductData(url);
          
          // Check if we should skip based on hash comparison
          // For products with ChildProducts, we need to check if ANY child needs updating
          let shouldSkip = false;
          let allChildrenUpToDate = true;
          
          if (productData.ChildProducts && Array.isArray(productData.ChildProducts)) {
            strapi.log.info(`Found ${productData.ChildProducts.length} child products in ${productCode}`);
            
            // Check each child product's hash status
            for (const childProduct of productData.ChildProducts) {
              const childSku = childProduct.Sku || childProduct.SupplierSku;
              if (!childSku) continue;
              
              const existingChild = existingProductsMap.get(childSku);
              const newHash = hash.trim();
              
              if (existingChild && existingChild.promidata_hash) {
                const existingHash = existingChild.promidata_hash.trim();
                if (existingHash !== newHash) {
                  allChildrenUpToDate = false;
                  strapi.log.info(`⚡ Child ${childSku} needs update - hash changed: ${existingHash} → ${newHash}`);
                  break;
                }
              } else {
                allChildrenUpToDate = false;
                strapi.log.info(`🆕 Child ${childSku} is new or missing hash`);
                break;
              }
            }
            
            if (allChildrenUpToDate) {
              shouldSkip = true;
              skipped += productData.ChildProducts.length; // Count all skipped children
              strapi.log.info(`✓ Skipping ${productCode} - all ${productData.ChildProducts.length} child products up to date with hash: ${hash.trim()}`);
            }
          } else {
            // Fallback for products without ChildProducts array (legacy handling)
            const existingProduct = existingProductsMap.get(productCode);
            const newHash = hash.trim();
            
            if (existingProduct && existingProduct.promidata_hash) {
              const existingHash = existingProduct.promidata_hash.trim();
              
              if (existingHash === newHash) {
                shouldSkip = true;
                skipped++;
                strapi.log.info(`✓ Skipping ${productCode} - hash unchanged: ${newHash}`);
              } else {
                strapi.log.info(`⚡ Processing ${productCode} - hash changed: ${existingHash} → ${newHash}`);
              }
            } else {
              strapi.log.info(`🆕 Processing ${productCode} - ${existingProduct ? 'missing hash' : 'new product'}: ${newHash}`);
            }
          }
          
          // Skip processing if all children are up to date
          if (shouldSkip) {
            continue;
          }
          
          strapi.log.info(`Product data fetched, creating/updating product...`);
          
          // Process child products with size consolidation
          if (productData.ChildProducts && Array.isArray(productData.ChildProducts) && productData.ChildProducts.length > 0) {
            strapi.log.info(`Processing ${productData.ChildProducts.length} child products from ${productCode} with size consolidation`);
            
            try {
              // Use consolidation for A113 and other suppliers that benefit from size consolidation
              const processedCount = await this.processConsolidatedProducts(productData.ChildProducts, supplier, hash);
              
              imported += processedCount.created;
              updated += processedCount.updated;
              
              if (processedCount.errors > 0) {
                errors.push({
                  productCode: productCode,
                  url: url,
                  error: `${processedCount.errors} child products failed during consolidation`
                });
              }
              
              strapi.log.info(`📦 Consolidated ${productData.ChildProducts.length} child products into ${processedCount.created + processedCount.updated} products (${processedCount.created} new, ${processedCount.updated} updated)`);
              
            } catch (error) {
              // Fallback to individual processing if consolidation fails
              strapi.log.warn(`Consolidation failed for ${productCode}, falling back to individual processing:`, error.message);
              
              for (let childIndex = 0; childIndex < productData.ChildProducts.length; childIndex++) {
                try {
                  const childProduct = productData.ChildProducts[childIndex];
                  const result = await this.createOrUpdateChildProduct(childProduct, supplier, hash, childIndex);
                  
                  if (result.created) {
                    imported++;
                    strapi.log.info(`✅ Created child product ${result.childProductCode}`);
                  } else {
                    updated++;
                    strapi.log.info(`🔄 Updated child product ${result.childProductCode}`);
                  }
                } catch (childError) {
                  const childProductCode = productData.ChildProducts[childIndex]?.Sku || 
                                          productData.ChildProducts[childIndex]?.SupplierSku || 
                                          `${productCode}-child-${childIndex}`;
                  errors.push({
                    productCode: childProductCode,
                    url: url,
                    error: `Child ${childIndex}: ${childError.message}`
                  });
                  strapi.log.error(`Error processing child product ${childIndex}: ${childProductCode}`, childError.message);
                }
              }
            }
          } else {
            // Fallback for products without ChildProducts (legacy handling)
            const result = await this.createOrUpdateProduct(productData, supplier, hash, url);
            if (result.created) {
              imported++;
              strapi.log.info(`✅ Product ${productCode} created with hash: ${hash}`);
            } else {
              updated++;
              strapi.log.info(`🔄 Product ${productCode} updated with hash: ${hash}`);
            }
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

      const totalProcessed = imported + updated;
      const totalAvailable = productsToProcess.length;
      const efficiencyPercent = totalAvailable > 0 ? Math.round((skipped / totalAvailable) * 100) : 0;
      
      strapi.log.info(`Sync completed for supplier: ${supplier.code} - Imported: ${imported}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors.length}`);
      strapi.log.info(`Incremental sync efficiency: ${efficiencyPercent}% skipped (${skipped}/${totalAvailable} unchanged)`);
      
      return {
        message: `Sync completed successfully - ${totalProcessed} processed, ${skipped} skipped (${efficiencyPercent}% efficiency)`,
        productsProcessed: totalProcessed,
        productsAvailable: totalAvailable,
        imported,
        updated,
        skipped,
        efficiency: `${efficiencyPercent}%`,
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
   * Extract child product SKU with supplier-specific rules
   */
  extractChildProductSku(childProduct: any, supplierCode: string, childIndex: number): string | null {
    // Apply supplier-specific SKU extraction rules
    if (supplierCode === 'A73') {
      // A73: Always use -BLSales variant as primary, remove variant suffixes
      let sku = childProduct.Sku || childProduct.SupplierSku;
      if (sku) {
        // Remove variant suffixes: -BLSales, -BOR6X4, -BOR8X4, -DiFC, etc.
        sku = sku.replace(/-BLSales$/, '').replace(/-BOR6X4$/, '').replace(/-BOR8X4$/, '').replace(/-DiFC$/, '');
        return sku;
      }
    } else if (supplierCode === 'A113') {
      // A113: Each color variant becomes separate product
      let sku = childProduct.Sku || childProduct.SupplierSku;
      if (sku) {
        // Keep full color model code (e.g., A113-W5501 for Black, A113-W5594 for Ebony gray)
        return sku;
      }
    }
    
    // Universal fallback: use Sku or SupplierSku as-is
    return childProduct.Sku || childProduct.SupplierSku || null;
  },

  /**
   * Extract product code from product data
   * For Promidata structure, the product code is typically in the URL filename
   */
  extractProductCode(productData: any, supplier: any, url?: string): string | null {
    // For Promidata, try to extract from root level SKU fields first
    if (productData.Sku) {
      return productData.Sku;
    }
    if (productData.SupplierSku) {
      return productData.SupplierSku;
    }
    
    // Fallback to URL extraction
    if (url) {
      const urlParts = url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const productCode = fileName.replace('.json', '');
      if (productCode) {
        return productCode;
      }
    }
    
    // Last resort: check other possible fields
    return productData.articlenumber || productData.sku_supplier || productData.SKU || 
           productData.Code || productData.code || productData.id || productData.sku ||
           productData.ProductCode || productData.ItemCode || productData.ArtNr || null;
  },

  /**
   * Group child products by variant (supplier + model + color) for consolidation
   */
  groupProductsByVariant(childProducts: any[], supplierCode: string): Map<string, any[]> {
    const productGroups = new Map<string, any[]>();
    
    for (const childProduct of childProducts) {
      // Create grouping key based on supplier + model + color
      const groupKey = this.createVariantGroupKey(childProduct, supplierCode);
      
      if (!productGroups.has(groupKey)) {
        productGroups.set(groupKey, []);
      }
      productGroups.get(groupKey)!.push(childProduct);
    }
    
    strapi.log.info(`Grouped ${childProducts.length} child products into ${productGroups.size} variants`);
    return productGroups;
  },

  /**
   * Create grouping key for product variants
   */
  createVariantGroupKey(childProduct: any, supplierCode: string): string {
    // Extract model and color from ProductDetails.en.ConfigurationFields
    let model = '';
    let colorValue = '';
    let size = '';
    
    if (childProduct.ProductDetails?.en?.ConfigurationFields) {
      for (const field of childProduct.ProductDetails.en.ConfigurationFields) {
        if (field.ConfigurationName === 'Color') {
          colorValue = field.ConfigurationValue || '';
        } else if (field.ConfigurationName === 'Size') {
          size = field.ConfigurationValue || '';
        } else if (field.ConfigurationName === 'Model') {
          model = field.ConfigurationValue || '';
        }
      }
    }
    
    // Fallback to SKU prefix if model not found
    if (!model && childProduct.SKU) {
      const skuParts = childProduct.SKU.split('-');
      model = skuParts.length > 1 ? skuParts.slice(0, -1).join('-') : skuParts[0];
    }
    
    // Create grouping key: supplier + model + color (NOT size - sizes should be grouped together)
    const primaryKey = `${model}-${colorValue}`.replace(/[^a-zA-Z0-9-_]/g, '-');
    
    return `${supplierCode}-${primaryKey}`;
  },

  /**
   * Select base variant from grouped products (for consolidated product)
   */
  selectBaseVariant(products: any[]): any {
    // Prefer first product or one with most complete data
    return products.reduce((best, current) => {
      const bestScore = this.calculateProductCompleteness(best);
      const currentScore = this.calculateProductCompleteness(current);
      return currentScore > bestScore ? current : best;
    }, products[0]);
  },

  /**
   * Calculate completeness score for a product variant
   */
  calculateProductCompleteness(product: any): number {
    let score = 0;
    
    // Basic fields
    if (product.Sku || product.SupplierSku) score += 10;
    if (product.ProductDetails?.en?.Name) score += 5;
    if (product.ProductDetails?.en?.Description) score += 5;
    if (product.Model) score += 3;
    if (product.ColorCode) score += 3;
    if (product.Size) score += 2;
    
    // Images
    if (product.Images && Array.isArray(product.Images) && product.Images.length > 0) score += 8;
    
    // Pricing
    if (product.Prices && Array.isArray(product.Prices) && product.Prices.length > 0) score += 5;
    
    return score;
  },

  /**
   * Create size-to-SKU mapping from grouped products
   */
  createSizeSkuMapping(products: any[]): any {
    const sizeSkus: any = {};
    
    for (const product of products) {
      const size = product.Size || product.size || 'One Size';
      const sku = product.Sku || product.SupplierSku;
      if (sku) {
        sizeSkus[size] = sku;
      }
    }
    
    return sizeSkus;
  },

  /**
   * Extract all available sizes from grouped products
   */
  extractAvailableSizes(products: any[]): string[] {
    const sizes = new Set<string>();
    
    for (const product of products) {
      const size = product.Size || product.size;
      if (size && size.trim()) {
        sizes.add(size.trim());
      }
    }
    
    // Return sorted sizes array, or default if none found
    const sizeArray = Array.from(sizes);
    return sizeArray.length > 0 ? sizeArray.sort() : ['One Size'];
  },

  /**
   * Merge pricing tiers from all size variants
   */
  mergePricingTiers(products: any[]): any[] {
    const allPrices: any[] = [];
    
    for (const product of products) {
      if (product.Prices && Array.isArray(product.Prices)) {
        allPrices.push(...product.Prices);
      }
    }
    
    // Remove duplicates and sort by quantity
    const uniquePrices = allPrices.filter((price, index, arr) => 
      arr.findIndex(p => p.Quantity === price.Quantity) === index
    );
    
    return uniquePrices.sort((a, b) => (a.Quantity || 0) - (b.Quantity || 0));
  },

  /**
   * Process consolidated products from child product groups
   */
  async processConsolidatedProducts(childProducts: any[], supplier: any, hash: string) {
    const productGroups = this.groupProductsByVariant(childProducts, supplier.code);
    const processedCount = { created: 0, updated: 0, errors: 0 };
    
    for (const [groupKey, groupedProducts] of productGroups) {
      try {
        const consolidatedProduct = await this.createConsolidatedProduct(groupedProducts, supplier, hash);
        
        if (consolidatedProduct.isNew) {
          processedCount.created++;
        } else {
          processedCount.updated++;
        }
        
        strapi.log.info(`✅ ${consolidatedProduct.isNew ? 'Created' : 'Updated'} consolidated product ${consolidatedProduct.sku} (${groupedProducts.length} sizes)`);
        
      } catch (error) {
        processedCount.errors++;
        strapi.log.error(`❌ Failed to process consolidated product group ${groupKey}:`, error.message);
      }
    }
    
    return processedCount;
  },

  /**
   * Create consolidated product from grouped variants
   */
  async createConsolidatedProduct(groupedProducts: any[], supplier: any, hash: string) {
    const baseProduct = this.selectBaseVariant(groupedProducts);
    const availableSizes = this.extractAvailableSizes(groupedProducts);
    const sizeSkus = this.createSizeSkuMapping(groupedProducts);
    const mergedPrices = this.mergePricingTiers(groupedProducts);
    
    // Generate base SKU for the consolidated product
    const baseSku = this.generateConsolidatedSku(baseProduct, supplier.code);
    
    // Check if consolidated product exists
    const existing = await strapi.entityService.findMany('api::product.product', {
      filters: { 
        sku: baseSku,
        supplier: supplier.id 
      }
    });
    
    // Build consolidated product data using base product as template
    const productData = await this.buildConsolidatedProductData(
      baseProduct, 
      supplier, 
      hash, 
      baseSku,
      availableSizes,
      sizeSkus,
      mergedPrices
    );
    
    let result;
    if (existing.length > 0) {
      // Update existing consolidated product
      result = await strapi.entityService.update('api::product.product', existing[0].id, {
        data: productData
      });
      result.isNew = false;
    } else {
      // Create new consolidated product
      result = await strapi.entityService.create('api::product.product', {
        data: productData
      });
      result.isNew = true;
    }
    
    result.sku = baseSku;
    return result;
  },

  /**
   * Generate consolidated SKU from base product
   */
  generateConsolidatedSku(baseProduct: any, supplierCode: string): string {
    const baseSku = baseProduct.Sku || baseProduct.SupplierSku;
    
    if (baseSku) {
      // Remove size-specific suffixes if present
      return baseSku.replace(/-[A-Z0-9]{1,3}$/, '').replace(/_[A-Z0-9]{1,3}$/, '');
    }
    
    // Fallback generation
    const model = baseProduct.Model || baseProduct.model || 'MODEL';
    const colorCode = baseProduct.ColorCode || baseProduct.color_code || '00';
    return `${supplierCode}-${model}${colorCode}`;
  },

  /**
   * Process pricing tiers from merged prices
   */
  async processPricingTiers(mergedPrices: any[]): Promise<any[]> {
    const priceTiers: any[] = [];
    
    for (const priceInfo of mergedPrices) {
      if (priceInfo.Quantity && priceInfo.Price !== undefined) {
        priceTiers.push({
          quantity: priceInfo.Quantity,
          price: parseFloat(priceInfo.Price),
          buying_price: priceInfo.BuyingPrice ? parseFloat(priceInfo.BuyingPrice) : null,
          currency: priceInfo.Currency || 'EUR',
          country_code: priceInfo.CountryCode || null,
          price_type: priceInfo.PriceType || 'selling',
          region: priceInfo.Region || null
        });
      }
    }
    
    return priceTiers;
  },

  /**
   * Process main image from base product
   */
  async processMainImage(baseProduct: any): Promise<number | null> {
    let mainImageUrl = null;
    
    if (baseProduct.ProductDetails) {
      const details = baseProduct.ProductDetails;
      // Try to get main image from English first, then other languages
      const langDetails = details.en || details.de || details.fr || details.nl || Object.values(details)[0];
      if (langDetails && langDetails.Image && langDetails.Image.Url) {
        mainImageUrl = langDetails.Image.Url;
      }
    }
    
    if (mainImageUrl) {
      const fileName = `${baseProduct.Sku || baseProduct.SupplierSku}-main.jpg`;
      return await this.uploadImageFromUrl(mainImageUrl, fileName);
    }
    
    return null;
  },

  /**
   * Process gallery images from base product
   */
  async processGalleryImages(baseProduct: any): Promise<number[]> {
    const galleryImageIds: number[] = [];
    const galleryImageUrls: string[] = [];
    
    if (baseProduct.ProductDetails) {
      const details = baseProduct.ProductDetails;
      const langDetails = details.en || details.de || details.fr || details.nl || Object.values(details)[0];
      
      // Extract gallery images
      if (langDetails && langDetails.MediaGalleryImages) {
        langDetails.MediaGalleryImages.forEach((img: any) => {
          if (img.Url) {
            galleryImageUrls.push(img.Url);
          }
        });
      }
    }
    
    // Upload gallery images
    for (let i = 0; i < galleryImageUrls.length; i++) {
      const fileName = `${baseProduct.Sku || baseProduct.SupplierSku}-gallery-${i + 1}.jpg`;
      const imageId = await this.uploadImageFromUrl(galleryImageUrls[i], fileName);
      if (imageId) {
        galleryImageIds.push(imageId);
      }
    }
    
    return galleryImageIds;
  },

  /**
   * Extract material information from product
   */
  extractMaterial(product: any): any {
    const materialJson: any = {};
    
    if (product.ProductDetails) {
      Object.keys(product.ProductDetails).forEach(lang => {
        const langDetails = product.ProductDetails[lang];
        
        // Look for material in various fields
        if (langDetails.Material) {
          materialJson[lang] = langDetails.Material;
        } else if (langDetails.UnstructuredInformation) {
          const material = langDetails.UnstructuredInformation.Material || 
                          langDetails.UnstructuredInformation.material ||
                          langDetails.UnstructuredInformation.Composition ||
                          langDetails.UnstructuredInformation.composition;
          if (material) {
            materialJson[lang] = material;
          }
        }
      });
    }
    
    return Object.keys(materialJson).length > 0 ? materialJson : null;
  },

  /**
   * Extract color data from product using correct nested paths
   */
  extractColorData(childProduct: any) {
    let hexColor = null;
    let supplierColorCode = null;
    let pmsColor = null;

    // Debug logging
    strapi.log.info(`🔍 Extracting color data for SKU: ${childProduct.SupplierSku || 'unknown'}`);

    // Extract hex color from NonLanguageDependedProductDetails
    if (childProduct.NonLanguageDependedProductDetails?.HexColor) {
      hexColor = childProduct.NonLanguageDependedProductDetails.HexColor;
      strapi.log.info(`✅ Found hex color: ${hexColor}`);
    } else {
      strapi.log.warn(`❌ No hex color found in NonLanguageDependedProductDetails`);
    }
    
    // Extract supplier color code and PMS from UnstructuredInformation
    if (childProduct.ProductDetails) {
      const languages = ['en', 'nl', 'de', 'fr'];
      for (const lang of languages) {
        const langDetails = childProduct.ProductDetails[lang];
        if (langDetails?.UnstructuredInformation) {
          if (langDetails.UnstructuredInformation.SupplierSearchColor && !supplierColorCode) {
            supplierColorCode = langDetails.UnstructuredInformation.SupplierSearchColor;
          }
          if (langDetails.UnstructuredInformation.PMSValue && !pmsColor) {
            pmsColor = langDetails.UnstructuredInformation.PMSValue;
          }
        }
      }
    }
    
    // Fallback to root level (legacy support)
    if (!supplierColorCode && childProduct.SupplierColorCode) {
      supplierColorCode = childProduct.SupplierColorCode;
    }
    if (!hexColor && childProduct.HexColor) {
      hexColor = childProduct.HexColor;
    }
    if (!pmsColor && childProduct.PMSColor) {
      pmsColor = childProduct.PMSColor;
    }

    // Debug final result
    strapi.log.info(`🎯 Final extracted color data: hexColor=${hexColor}, supplierColorCode=${supplierColorCode}, pmsColor=${pmsColor}`);
    return { hex_color: hexColor, supplier_color_code: supplierColorCode, pms_color: pmsColor };
  },

  /**
   * Build consolidated product data structure
   */
  async buildConsolidatedProductData(baseProduct: any, supplier: any, hash: string, baseSku: string, availableSizes: string[], sizeSkus: any, mergedPrices: any[]) {
    // Extract multilingual data from base product
    const nameJson: any = {};
    const descriptionJson: any = {};
    const colorNameJson: any = {};
    const modelNameJson: any = {};
    const shortDescriptionJson: any = {};
    
    if (baseProduct.ProductDetails) {
      const details = baseProduct.ProductDetails;
      ['en', 'de', 'fr', 'nl'].forEach(lang => {
        if (details[lang]) {
          if (details[lang].Name) nameJson[lang] = details[lang].Name;
          if (details[lang].Description) descriptionJson[lang] = details[lang].Description;
          if (details[lang].ShortDescription) shortDescriptionJson[lang] = details[lang].ShortDescription;
          if (details[lang].ModelName) modelNameJson[lang] = details[lang].ModelName;
          if (details[lang].ColorName) colorNameJson[lang] = details[lang].ColorName;
        }
      });
    }
    
    // Process pricing tiers
    const priceTiers = await this.processPricingTiers(mergedPrices);
    
    // Process images (use base product images)
    const mainImageId = await this.processMainImage(baseProduct);
    const galleryImageIds = await this.processGalleryImages(baseProduct);
    
    // Build consolidated product data
    const productData: any = {
      sku: baseSku,
      model: baseProduct.Model || baseProduct.model,
      article_number: baseProduct.ArtNr || baseProduct.articlenumber,
      sku_supplier: baseProduct.SupplierSku,
      name: nameJson,
      description: descriptionJson,
      short_description: shortDescriptionJson,
      color_name: colorNameJson,
      color_code: baseProduct.ColorCode || baseProduct.color_code,
      model_name: modelNameJson,
      search_color: baseProduct.SearchColor || baseProduct.search_color,
      dimension: baseProduct.Dimension || baseProduct.dimension,
      weight: baseProduct.Weight || baseProduct.weight,
      brand: baseProduct.Brand || baseProduct.brand,
      material: this.extractMaterial(baseProduct),
      country_of_origin: baseProduct.CountryOfOrigin || baseProduct.country_of_origin,
      delivery_time: baseProduct.DeliveryTime || baseProduct.delivery_time,
      customs_tariff_number: baseProduct.CustomsTariffNumber || baseProduct.customs_tariff_number,
      // Extract color data using improved logic
      ...this.extractColorData(baseProduct),
      supplier: supplier.id,
      promidata_hash: hash,
      last_synced: new Date(),
      is_active: true,
      
      // Size consolidation fields
      available_sizes: availableSizes,
      size_skus: sizeSkus,
      variant_type: (availableSizes && availableSizes.length > 1 ? 'multi_size' : 'single') as 'multi_size' | 'single',
      
      // Components
      price_tiers: priceTiers,
      main_image: mainImageId,
      gallery_images: galleryImageIds
    };
    
    return productData;
  },

  /**
   * Create or update a single child product (legacy method - still used for non-consolidated sync)
   */
  async createOrUpdateChildProduct(childProduct: any, supplier: any, hash: string, childIndex: number) {
    try {
      // Apply supplier-specific SKU extraction rules
      const childProductCode = this.extractChildProductSku(childProduct, supplier.code, childIndex);
      if (!childProductCode) {
        throw new Error(`No valid SKU found for child product at index ${childIndex}`);
      }

      // Check if this specific child product exists
      const existing = await strapi.entityService.findMany('api::product.product', {
        filters: { 
          sku: childProductCode,
          supplier: supplier.id 
        }
      });
      
      // Extract product name from child product (multilingual JSON)
      const nameJson: any = {};
      if (childProduct.ProductDetails) {
        const details = childProduct.ProductDetails;
        if (details.en && details.en.Name) nameJson.en = details.en.Name;
        if (details.de && details.de.Name) nameJson.de = details.de.Name;
        if (details.fr && details.fr.Name) nameJson.fr = details.fr.Name;
        if (details.nl && details.nl.Name) nameJson.nl = details.nl.Name;
      }
      
      // Extract description from child product (multilingual JSON)
      const descriptionJson: any = {};
      if (childProduct.ProductDetails) {
        const details = childProduct.ProductDetails;
        if (details.en && details.en.Description) descriptionJson.en = details.en.Description;
        if (details.de && details.de.Description) descriptionJson.de = details.de.Description;
        if (details.fr && details.fr.Description) descriptionJson.fr = details.fr.Description;
        if (details.nl && details.nl.Description) descriptionJson.nl = details.nl.Description;
      }
      
      // Extract price tiers from child product with enhanced structure
      const priceTiers = [];
      if (childProduct.ProductPriceCountryBased) {
        const priceData = childProduct.ProductPriceCountryBased;
        
        // Process all regions (EURO, BENELUX, etc.)
        Object.keys(priceData).forEach(regionCode => {
          const region = priceData[regionCode];
          
          // Process RecommendedSellingPrice
          if (region.RecommendedSellingPrice && Array.isArray(region.RecommendedSellingPrice)) {
            region.RecommendedSellingPrice.forEach((priceInfo: any) => {
              if (priceInfo.Quantity && priceInfo.Price !== undefined) {
                priceTiers.push({
                  quantity: priceInfo.Quantity,
                  price: parseFloat(priceInfo.Price),
                  buying_price: null,
                  currency: 'EUR',
                  country_code: regionCode,
                  price_type: 'recommended',
                  region: regionCode
                });
              }
            });
          }
          
          // Process GeneralBuyingPrice
          if (region.GeneralBuyingPrice && Array.isArray(region.GeneralBuyingPrice)) {
            region.GeneralBuyingPrice.forEach((priceInfo: any) => {
              if (priceInfo.Quantity && priceInfo.Price !== undefined) {
                priceTiers.push({
                  quantity: priceInfo.Quantity,
                  price: parseFloat(priceInfo.Price),
                  buying_price: parseFloat(priceInfo.Price),
                  currency: 'EUR',
                  country_code: regionCode,
                  price_type: 'buying',
                  region: regionCode
                });
              }
            });
          }
        });
      }

      // Extract images from child product (multilingual)
      let mainImageUrl = null;
      const galleryImageUrls = [];
      if (childProduct.ProductDetails) {
        const details = childProduct.ProductDetails;
        // Try to get main image from English first, then other languages
        const langDetails = details.en || details.de || details.fr || details.nl || Object.values(details)[0];
        if (langDetails && langDetails.Image && langDetails.Image.Url) {
          mainImageUrl = langDetails.Image.Url;
        }
        // Extract gallery images
        if (langDetails && langDetails.MediaGalleryImages) {
          langDetails.MediaGalleryImages.forEach((img: any) => {
            if (img.Url) {
              galleryImageUrls.push(img.Url);
            }
          });
        }
      }

      // Extract size information and handle variant aggregation
      let sizeValue = null;
      let availableSizes = [];
      
      // Extract size from ConfigurationFields
      if (childProduct.ProductDetails) {
        Object.keys(childProduct.ProductDetails).forEach(lang => {
          const langDetails = childProduct.ProductDetails[lang];
          if (langDetails.ConfigurationFields) {
            const sizeField = langDetails.ConfigurationFields.find((field: any) => 
              field.ConfigurationName && 
              (field.ConfigurationName.toLowerCase().includes('size') || 
               field.ConfigurationName.toLowerCase().includes('maat') ||
               field.ConfigurationName.toLowerCase().includes('größe') ||
               field.ConfigurationName.includes('CONFIG_3') ||
               field.ConfigurationNameTranslated && 
               (field.ConfigurationNameTranslated.toLowerCase().includes('size') ||
                field.ConfigurationNameTranslated.toLowerCase().includes('maat') ||
                field.ConfigurationNameTranslated.toLowerCase().includes('größe')))
            );
            if (sizeField && sizeField.ConfigurationValue && !sizeValue) {
              sizeValue = sizeField.ConfigurationValue;
              availableSizes.push(sizeField.ConfigurationValue);
            }
          }
        });
      }

      // Extract color information from child product
      const colorNameJson: any = {};
      let searchColor = null;
      let colorCode = null;
      
      // Extract color names from ConfigurationFields
      if (childProduct.ProductDetails) {
        Object.keys(childProduct.ProductDetails).forEach(lang => {
          const langDetails = childProduct.ProductDetails[lang];
          if (langDetails.ConfigurationFields) {
            const colorField = langDetails.ConfigurationFields.find((field: any) => 
              field.ConfigurationName && 
              (field.ConfigurationName.toLowerCase().includes('color') || 
               field.ConfigurationName.toLowerCase().includes('kleur') ||
               field.ConfigurationName.toLowerCase().includes('farbe') ||
               field.ConfigurationName.includes('CONFIG_2') ||
               field.ConfigurationNameTranslated && 
               (field.ConfigurationNameTranslated.toLowerCase().includes('color') ||
                field.ConfigurationNameTranslated.toLowerCase().includes('kleur') ||
                field.ConfigurationNameTranslated.toLowerCase().includes('farbe') ||
                field.ConfigurationNameTranslated.toLowerCase().includes('colour')))
            );
            if (colorField && colorField.ConfigurationValue) {
              colorNameJson[lang] = colorField.ConfigurationValue;
            }
          }
          // Extract PMS color code
          if (langDetails.UnstructuredInformation && langDetails.UnstructuredInformation.PMSValue) {
            colorCode = langDetails.UnstructuredInformation.PMSValue;
          }
        });
      }
      
      // Extract search color from NonLanguageDependedProductDetails
      if (childProduct.NonLanguageDependedProductDetails && childProduct.NonLanguageDependedProductDetails.SearchColor) {
        searchColor = childProduct.NonLanguageDependedProductDetails.SearchColor;
      }

      // Extract material information from child product (multilingual)
      const materialJson: any = {};
      if (childProduct.ProductDetails) {
        const details = childProduct.ProductDetails;
        Object.keys(details).forEach(lang => {
          const langDetails = details[lang];
          if (langDetails.WebShopInformation && langDetails.WebShopInformation.Material && langDetails.WebShopInformation.Material.InformationValue) {
            materialJson[lang] = langDetails.WebShopInformation.Material.InformationValue;
          }
        });
      }

      // Extract weight and other details from child product
      let weightValue = null;
      let categoryValue = null;
      let dimensionsValue = null;
      let brandValue = null;
      let countryOfOrigin = null;
      let customsTariffNumber = null;
      let eanValue = null;
      
      if (childProduct.NonLanguageDependedProductDetails) {
        const details = childProduct.NonLanguageDependedProductDetails;
        weightValue = details.Weight || null;
        categoryValue = details.Category;
        brandValue = details.Brand;
        countryOfOrigin = details.CountryOfOrigin;
        customsTariffNumber = details.CustomsTariffNumber;
        
        if (details.DimensionsLength || details.DimensionsWidth || details.DimensionsHeight) {
          dimensionsValue = `${details.DimensionsLength || 0} x ${details.DimensionsWidth || 0} x ${details.DimensionsHeight || 0} mm`;
        }
        
        // EAN might be in different places, check common locations
        eanValue = details.EAN || details.Ean || details.ean || null;
      }
      
      // CRITICAL FIX: Extract EAN from correct JSON path - ImprintPositions
      if (!eanValue && childProduct.ImprintPositions && Array.isArray(childProduct.ImprintPositions)) {
        for (const imprintPos of childProduct.ImprintPositions) {
          if (imprintPos.Ean) {
            eanValue = imprintPos.Ean;
            break; // Use first found EAN
          }
        }
      }
      
      // Also check child product root level for EAN (fallback)
      if (!eanValue && childProduct.Ean) {
        eanValue = childProduct.Ean;
      }

      // Extract missing critical fields
      let requiredCertificates = null;
      let batteryInformation = null;
      let webShopInfo = null;
      let productFilters = null;
      let deliveryTimeDays = null;
      let shortDescriptionJson = {};
      let hexColor = null;
      let supplierColorCode = null;
      let pmsColor = null;
      let imprintPositions = [];

      // Extract required certificates
      if (childProduct.RequiredCertificates) {
        requiredCertificates = Array.isArray(childProduct.RequiredCertificates) 
          ? childProduct.RequiredCertificates.join(', ') 
          : childProduct.RequiredCertificates;
      }

      // Extract battery information
      if (childProduct.BatteryInformation) {
        batteryInformation = childProduct.BatteryInformation;
      }

      // Extract delivery time from UnstructuredInformation
      if (childProduct.ProductDetails) {
        Object.keys(childProduct.ProductDetails).forEach(lang => {
          const langDetails = childProduct.ProductDetails[lang];
          if (langDetails.UnstructuredInformation) {
            if (langDetails.UnstructuredInformation.DeliveryTimeInDays) {
              deliveryTimeDays = parseInt(langDetails.UnstructuredInformation.DeliveryTimeInDays);
            }
            if (langDetails.UnstructuredInformation.PMSValue) {
              pmsColor = langDetails.UnstructuredInformation.PMSValue;
            }
          }
          // Extract short description
          if (langDetails.ShortDescription) {
            shortDescriptionJson[lang] = langDetails.ShortDescription;
          }
          // Extract web shop information
          if (langDetails.WebShopInformation) {
            webShopInfo = webShopInfo || {};
            webShopInfo[lang] = langDetails.WebShopInformation;
          }
        });
      }

      // Extract product filters from NonLanguageDependedProductDetails
      if (childProduct.NonLanguageDependedProductDetails && childProduct.NonLanguageDependedProductDetails.ProductFiltersByGroup) {
        productFilters = childProduct.NonLanguageDependedProductDetails.ProductFiltersByGroup;
      }

      // Extract color data using improved logic
      const colorData = this.extractColorData(childProduct);
      hexColor = colorData.hex_color;
      supplierColorCode = colorData.supplier_color_code;
      if (colorData.pms_color) {
        pmsColor = colorData.pms_color; // Override if extracted from new method
      }

      // Extract imprint positions
      if (childProduct.ImprintPositions && Array.isArray(childProduct.ImprintPositions)) {
        childProduct.ImprintPositions.forEach((imprintPos, index) => {
          const imprintData = {
            position_code: imprintPos.PositionCode || `pos-${index}`,
            position_name: {},
            ean: imprintPos.Ean || null,
            max_colors: imprintPos.MaxColors || 1,
            print_technique: imprintPos.PrintTechnique || null,
            max_dimensions: imprintPos.MaxDimensions || null,
            setup_costs: imprintPos.SetupCosts || null,
            print_costs: imprintPos.PrintCosts || null,
            is_active: true
          };

          // Extract multilingual position names
          if (imprintPos.ImprintLocationTexts) {
            Object.keys(imprintPos.ImprintLocationTexts).forEach(lang => {
              if (imprintPos.ImprintLocationTexts[lang] && imprintPos.ImprintLocationTexts[lang].Name) {
                imprintData.position_name[lang] = imprintPos.ImprintLocationTexts[lang].Name;
              }
            });
          }

          imprintPositions.push(imprintData);
        });
      }

      // SKIP IMAGE UPLOAD FOR LEGACY PRODUCTS
      // Images are now handled by consolidated products to prevent duplication
      // This legacy method is only for products without ChildProducts array
      let mainImageId = null;
      const galleryImageIds = [];
      
      strapi.log.info(`⚠️ Legacy product ${childProductCode} - skipping image upload (handled by consolidated products)`);

      const data = {
        sku: childProductCode,
        sku_supplier: childProduct.SupplierSku || childProductCode,
        name: nameJson,
        description: descriptionJson,
        short_description: shortDescriptionJson,
        supplier: supplier.id,
        price_tiers: priceTiers,
        weight: weightValue,
        dimension: dimensionsValue,
        main_category: categoryValue,
        brand: brandValue,
        material: materialJson,
        color_name: colorNameJson,
        color_code: colorCode,
        search_color: searchColor,
        size: sizeValue,
        available_sizes: availableSizes,
        hex_color: hexColor,
        supplier_color_code: supplierColorCode,
        pms_color: pmsColor,
        country_of_origin: countryOfOrigin,
        customs_tariff_number: customsTariffNumber,
        delivery_time_days: deliveryTimeDays,
        required_certificates: requiredCertificates,
        battery_information: batteryInformation,
        web_shop_info: webShopInfo,
        product_filters: productFilters,
        imprint_positions: imprintPositions,
        ean: eanValue,
        main_image: mainImageId,
        gallery_images: galleryImageIds,
        variant_type: 'single' as const, // Individual products are always single variants
        promidata_hash: hash,
        last_synced: new Date().toISOString(),
        is_active: true
      };

      let product;
      let created = false;

      if (existing.length > 0) {
        // Update existing child product
        product = await strapi.entityService.update('api::product.product', existing[0].id, { data });
        created = false;
      } else {
        // Create new child product
        product = await strapi.entityService.create('api::product.product', { data });
        created = true;
      }

      return { product, created, childProductCode };

    } catch (error) {
      strapi.log.error(`Failed to create/update child product at index ${childIndex}:`, error);
      throw error;
    }
  },

  /**
   * Create or update a product with hash tracking (legacy method for products without ChildProducts)
   */
  async createOrUpdateProduct(productData: any, supplier: any, hash: string, url?: string) {
    try {
      // This is a legacy method for products without ChildProducts array
      // Most products should use the ChildProducts array and go through createOrUpdateChildProduct instead
      
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

      // Basic product data structure for legacy products
      const data = {
        sku: productCode,
        sku_supplier: productData.SupplierSku || productCode,
        name: { en: productData.name || productCode },
        description: { en: productData.description || '' },
        supplier: supplier.id,
        price_tiers: [],
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
      strapi.log.error(`Failed to create/update legacy product ${this.extractProductCode(productData, supplier, url)}:`, error);
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
   * Upload image from URL to Strapi media library
   */
  async uploadImageFromUrl(imageUrl: string, fileName: string): Promise<number | null> {
    try {
      strapi.log.debug(`Uploading image from URL: ${imageUrl}`);
      
      // Extract file extension from URL first for filename check
      let extension = 'jpg';
      if (imageUrl.includes('.png')) extension = 'png';
      else if (imageUrl.includes('.gif')) extension = 'gif';
      else if (imageUrl.includes('.webp')) extension = 'webp';
      
      const cleanFileName = `${fileName}.${extension}`;
      
      // CHECK FOR EXISTING IMAGE FIRST (deduplication)
      const existingFile = await strapi.db.query('plugin::upload.file').findOne({
        where: { name: cleanFileName }
      });
      
      if (existingFile) {
        strapi.log.debug(`📁 Image already exists: ${cleanFileName}, reusing ID: ${existingFile.id}`);
        return existingFile.id;
      }
      
      // Download image from URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      
      // Get image buffer and content type
      const imageBuffer = await response.buffer();
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      // Update extension from content type if needed
      if (contentType.includes('png')) extension = 'png';
      else if (contentType.includes('gif')) extension = 'gif';
      else if (contentType.includes('webp')) extension = 'webp';
      
      const r2 = new (require('@aws-sdk/client-s3').S3Client)({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      });

      const uploadParams = {
        Bucket: process.env.R2_BUCKET_NAME,
        Key: cleanFileName,
        Body: imageBuffer,
        ContentType: contentType,
      };

      await r2.send(new (require('@aws-sdk/client-s3').PutObjectCommand)(uploadParams));

      const fileStat = { size: imageBuffer.length };

      const file = {
        name: cleanFileName,
        hash: crypto.createHash('md5').update(cleanFileName).digest('hex'),
        ext: `.${extension}`,
        mime: contentType,
        size: fileStat.size / 1024,
        url: `${process.env.R2_PUBLIC_URL}/${cleanFileName}`,
        provider: 'aws-s3',
        provider_metadata: {
          public_id: cleanFileName,
          resource_type: 'image',
        },
        folderPath: '/',
      };

      const uploadedFile = await strapi.entityService.create('plugin::upload.file', {
        data: file,
      });

      return Number(uploadedFile.id);
    } catch (error) {
      strapi.log.error(`Failed to upload image from ${imageUrl}:`, error.message);
      return null;
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
