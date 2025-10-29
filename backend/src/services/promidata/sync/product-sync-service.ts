/**
 * Product Sync Service
 * Handles creating and updating Product entities in Strapi
 */

import { ProductData } from '../transformers/product-transformer';
import hashService from './hash-service';

/**
 * Product Sync Result
 */
export interface ProductSyncResult {
  productId: number | string;
  isNew: boolean;
  updated: boolean;
}

/**
 * Batch Hash Check Result
 */
export interface BatchHashCheckResult {
  aNumber: string;
  exists: boolean;
  productId?: number;
  currentHash?: string;
  needsUpdate: boolean;
}

/**
 * Product Sync Service Class
 */
class ProductSyncService {
  /**
   * Find Product by a_number
   */
  public async findByANumber(
    aNumber: string,
    supplierId: number
  ): Promise<any | null> {
    try {
      const product = await strapi.db.query('api::product.product').findOne({
        where: {
          a_number: aNumber,
          supplier: supplierId,
        },
        select: ['id', 'sku', 'a_number', 'promidata_hash', 'last_synced'],
      });

      return product;
    } catch (error) {
      strapi.log.error(`[ProductSync] Error finding product ${aNumber}:`, error);
      return null;
    }
  }

  /**
   * Create new Product
   */
  public async create(productData: ProductData): Promise<ProductSyncResult> {
    try {
      strapi.log.info(`[ProductSync] Creating product ${productData.a_number}`);

      const created = await strapi.entityService.create('api::product.product', {
        data: productData as any,
      });

      return {
        productId: created.id,
        isNew: true,
        updated: false,
      };
    } catch (error) {
      strapi.log.error(`[ProductSync] Error creating product ${productData.a_number}:`, error);
      throw error;
    }
  }

  /**
   * Update existing Product
   */
  public async update(
    productId: number,
    productData: Partial<ProductData>
  ): Promise<ProductSyncResult> {
    try {
      strapi.log.info(`[ProductSync] Updating product ${productId}`);

      await strapi.entityService.update('api::product.product', productId, {
        data: productData as any,
      });

      return {
        productId,
        isNew: false,
        updated: true,
      };
    } catch (error) {
      strapi.log.error(`[ProductSync] Error updating product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Create or update Product
   * Returns sync result with product ID
   */
  public async createOrUpdate(productData: ProductData): Promise<ProductSyncResult> {
    // Check if product exists
    const existing = await this.findByANumber(
      productData.a_number,
      productData.supplier!
    );

    if (existing) {
      // Check if update is needed (hash comparison)
      const needsUpdate = !hashService.compareHashes(
        existing.promidata_hash || '',
        productData.promidata_hash || ''
      );

      if (needsUpdate) {
        return await this.update(existing.id, productData);
      } else {
        strapi.log.info(`[ProductSync] Product ${productData.a_number} unchanged, skipping`);
        return {
          productId: existing.id,
          isNew: false,
          updated: false,
        };
      }
    } else {
      return await this.create(productData);
    }
  }

  /**
   * Batch hash checking (Quick Win #2 optimization)
   * Single database query to check all products at once
   */
  public async batchHashCheck(
    aNumbers: string[],
    supplierId: number
  ): Promise<Map<string, BatchHashCheckResult>> {
    try {
      strapi.log.info(`[ProductSync] 🚀 Performing batch hash check for ${aNumbers.length} products...`);

      // Single batch query
      const existingProducts = await strapi.db.query('api::product.product').findMany({
        where: {
          supplier: supplierId,
          a_number: { $in: aNumbers },
        },
        select: ['id', 'a_number', 'promidata_hash'],
      });

      strapi.log.info(`[ProductSync] Found ${existingProducts.length} existing products`);

      // Create result map
      const resultMap = new Map<string, BatchHashCheckResult>();

      // Mark existing products
      for (const product of existingProducts) {
        resultMap.set(product.a_number, {
          aNumber: product.a_number,
          exists: true,
          productId: product.id,
          currentHash: product.promidata_hash,
          needsUpdate: false, // Will be determined when comparing with new hash
        });
      }

      // Mark non-existing products
      for (const aNumber of aNumbers) {
        if (!resultMap.has(aNumber)) {
          resultMap.set(aNumber, {
            aNumber,
            exists: false,
            needsUpdate: true, // New products always need "update" (creation)
          });
        }
      }

      return resultMap;
    } catch (error) {
      strapi.log.error('[ProductSync] Batch hash check failed:', error);
      throw error;
    }
  }

  /**
   * Determine which products need syncing
   * Compares import hashes with existing hashes
   */
  public async filterProductsNeedingSync(
    productFamilies: Array<{ aNumber: string; hash: string }>,
    supplierId: number
  ): Promise<{
    needsSync: Array<{ aNumber: string; hash: string }>;
    skipped: number;
    efficiency: number;
  }> {
    const aNumbers = productFamilies.map(f => f.aNumber);
    const hashCheckResults = await this.batchHashCheck(aNumbers, supplierId);

    const needsSync: Array<{ aNumber: string; hash: string }> = [];

    for (const family of productFamilies) {
      const checkResult = hashCheckResults.get(family.aNumber);

      if (!checkResult) {
        // Shouldn't happen, but handle gracefully
        needsSync.push(family);
        continue;
      }

      if (!checkResult.exists) {
        // New product
        needsSync.push(family);
      } else if (checkResult.currentHash !== family.hash) {
        // Hash mismatch - product changed
        needsSync.push(family);
      }
      // else: Hash matches, skip this product
    }

    const skipped = productFamilies.length - needsSync.length;
    const efficiency = productFamilies.length > 0
      ? (skipped / productFamilies.length) * 100
      : 0;

    strapi.log.info(`[ProductSync] ✓ Skipping ${skipped} unchanged products (${efficiency.toFixed(1)}% efficiency)`);
    strapi.log.info(`[ProductSync] ⚡ Processing ${needsSync.length} new/changed products`);

    return {
      needsSync,
      skipped,
      efficiency,
    };
  }

  /**
   * Get Product with relations
   */
  public async findById(productId: number): Promise<any> {
    try {
      return await strapi.entityService.findOne('api::product.product', productId, {
        populate: ['supplier'], // Note: 'variants' relation will be available after ProductVariant schema is created
      });
    } catch (error) {
      strapi.log.error(`[ProductSync] Error finding product ${productId}:`, error);
      return null;
    }
  }

  /**
   * Delete Product (and cascading variants)
   */
  public async delete(productId: number): Promise<boolean> {
    try {
      strapi.log.info(`[ProductSync] Deleting product ${productId}`);
      await strapi.entityService.delete('api::product.product', productId);
      return true;
    } catch (error) {
      strapi.log.error(`[ProductSync] Error deleting product ${productId}:`, error);
      return false;
    }
  }

  /**
   * Get Products by supplier
   */
  public async findBySupplier(
    supplierId: number,
    limit: number = 100,
    offset: number = 0
  ): Promise<any[]> {
    try {
      return await strapi.db.query('api::product.product').findMany({
        where: { supplier: supplierId },
        limit,
        offset,
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      strapi.log.error(`[ProductSync] Error finding products for supplier ${supplierId}:`, error);
      return [];
    }
  }

  /**
   * Count products by supplier
   */
  public async countBySupplier(supplierId: number): Promise<number> {
    try {
      return await strapi.db.query('api::product.product').count({
        where: { supplier: supplierId },
      });
    } catch (error) {
      strapi.log.error(`[ProductSync] Error counting products for supplier ${supplierId}:`, error);
      return 0;
    }
  }
}

// Export singleton instance
export default new ProductSyncService();
