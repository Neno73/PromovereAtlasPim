/**
 * Product Variant Sync Service
 * Handles creating and updating ProductVariant entities in Strapi
 */

import { ProductVariantData } from '../transformers/variant-transformer';

/**
 * Variant Sync Result
 */
export interface VariantSyncResult {
  variantId: number | string;
  isNew: boolean;
  updated: boolean;
}

/**
 * Product Variant Sync Service Class
 */
class VariantSyncService {
  /**
   * Find Variant by SKU
   */
  public async findBySku(sku: string): Promise<any | null> {
    try {
      const variant = await strapi.db.query('api::product-variant.product-variant').findOne({
        where: { sku },
        select: ['id', 'sku', 'product', 'color', 'size', 'is_primary_for_color'],
      });

      return variant;
    } catch (error) {
      console.error(`[VariantSync] Error finding variant ${sku}:`, error);
      return null;
    }
  }

  /**
   * Create new Variant
   */
  public async create(variantData: ProductVariantData): Promise<VariantSyncResult> {
    try {
      console.log(`[VariantSync] Creating variant ${variantData.sku}`);

      const created = await strapi.entityService.create('api::product-variant.product-variant' as any, {
        data: variantData as any,
      });

      return {
        variantId: created.id,
        isNew: true,
        updated: false,
      };
    } catch (error) {
      console.error(`[VariantSync] Error creating variant ${variantData.sku}:`, error);
      throw error;
    }
  }

  /**
   * Update existing Variant
   */
  public async update(
    variantId: number,
    variantData: Partial<ProductVariantData>
  ): Promise<VariantSyncResult> {
    try {
      console.log(`[VariantSync] Updating variant ${variantId}`);

      await strapi.entityService.update('api::product-variant.product-variant' as any, variantId, {
        data: variantData as any,
      });

      return {
        variantId,
        isNew: false,
        updated: true,
      };
    } catch (error) {
      console.error(`[VariantSync] Error updating variant ${variantId}:`, error);
      throw error;
    }
  }

  /**
   * Create or update Variant
   */
  public async createOrUpdate(variantData: ProductVariantData): Promise<VariantSyncResult> {
    const existing = await this.findBySku(variantData.sku);

    if (existing) {
      // Always update to ensure data is current
      return await this.update(existing.id, variantData);
    } else {
      return await this.create(variantData);
    }
  }

  /**
   * Find all variants for a product
   */
  public async findByProduct(productId: number): Promise<any[]> {
    try {
      return await strapi.db.query('api::product-variant.product-variant').findMany({
        where: { product: productId },
        orderBy: { color: 'asc', size: 'asc' },
      });
    } catch (error) {
      console.error(`[VariantSync] Error finding variants for product ${productId}:`, error);
      return [];
    }
  }

  /**
   * Find primary variants for a product
   * (One per color)
   */
  public async findPrimaryVariants(productId: number): Promise<any[]> {
    try {
      return await strapi.db.query('api::product-variant.product-variant').findMany({
        where: {
          product: productId,
          is_primary_for_color: true,
        },
        orderBy: { color: 'asc' },
      });
    } catch (error) {
      console.error(`[VariantSync] Error finding primary variants for product ${productId}:`, error);
      return [];
    }
  }

  /**
   * Find variants by color
   */
  public async findByColor(productId: number, color: string): Promise<any[]> {
    try {
      return await strapi.db.query('api::product-variant.product-variant').findMany({
        where: {
          product: productId,
          color,
        },
        orderBy: { size: 'asc' },
      });
    } catch (error) {
      console.error(`[VariantSync] Error finding variants for color ${color}:`, error);
      return [];
    }
  }

  /**
   * Set primary variant for color
   * Unsets other variants of the same color
   */
  public async setPrimaryForColor(
    productId: number,
    variantId: number,
    color: string
  ): Promise<void> {
    try {
      // Unset all other variants of this color
      const colorVariants = await this.findByColor(productId, color);

      for (const variant of colorVariants) {
        if (variant.id !== variantId && variant.is_primary_for_color) {
          await this.update(variant.id, { is_primary_for_color: false });
        }
      }

      // Set this variant as primary
      await this.update(variantId, { is_primary_for_color: true });

      console.log(`[VariantSync] Set variant ${variantId} as primary for color ${color}`);
    } catch (error) {
      console.error(`[VariantSync] Error setting primary variant:`, error);
      throw error;
    }
  }

  /**
   * Delete Variant
   */
  public async delete(variantId: number): Promise<boolean> {
    try {
      console.log(`[VariantSync] Deleting variant ${variantId}`);
      await strapi.entityService.delete('api::product-variant.product-variant' as any, variantId);
      return true;
    } catch (error) {
      console.error(`[VariantSync] Error deleting variant ${variantId}:`, error);
      return false;
    }
  }

  /**
   * Delete all variants for a product
   */
  public async deleteByProduct(productId: number): Promise<number> {
    try {
      const variants = await this.findByProduct(productId);
      let deletedCount = 0;

      for (const variant of variants) {
        const success = await this.delete(variant.id);
        if (success) deletedCount++;
      }

      console.log(`[VariantSync] Deleted ${deletedCount}/${variants.length} variants for product ${productId}`);
      return deletedCount;
    } catch (error) {
      console.error(`[VariantSync] Error deleting variants for product ${productId}:`, error);
      return 0;
    }
  }

  /**
   * Count variants by product
   */
  public async countByProduct(productId: number): Promise<number> {
    try {
      return await strapi.db.query('api::product-variant.product-variant').count({
        where: { product: productId },
      });
    } catch (error) {
      console.error(`[VariantSync] Error counting variants for product ${productId}:`, error);
      return 0;
    }
  }

  /**
   * Get variant with relations
   */
  public async findById(variantId: number): Promise<any> {
    try {
      return await strapi.entityService.findOne('api::product-variant.product-variant' as any, variantId, {
        populate: ['product', 'primary_image', 'gallery_images'],
      });
    } catch (error) {
      console.error(`[VariantSync] Error finding variant ${variantId}:`, error);
      return null;
    }
  }

  /**
   * Batch create variants
   * More efficient than creating one by one
   */
  public async batchCreate(variantsData: ProductVariantData[]): Promise<VariantSyncResult[]> {
    const results: VariantSyncResult[] = [];

    // Process in parallel with limited concurrency
    const batchSize = 5;
    for (let i = 0; i < variantsData.length; i += batchSize) {
      const batch = variantsData.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(variantData => this.createOrUpdate(variantData))
      );

      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Update variant images
   * Separate method for updating just the image references
   */
  public async updateImages(
    variantId: number,
    primaryImageId?: number,
    galleryImageIds?: number[]
  ): Promise<boolean> {
    try {
      const updateData: any = {};

      if (primaryImageId !== undefined) {
        updateData.primary_image = primaryImageId;
      }

      if (galleryImageIds !== undefined) {
        updateData.gallery_images = galleryImageIds;
      }

      if (Object.keys(updateData).length > 0) {
        await this.update(variantId, updateData);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`[VariantSync] Error updating images for variant ${variantId}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export default new VariantSyncService();
