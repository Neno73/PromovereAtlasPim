/**
 * Hash Service
 * Calculates hashes for Products and Variants to detect changes
 */

import crypto from 'crypto';
import { ProductData } from '../transformers/product-transformer';
import { ProductVariantData } from '../transformers/variant-transformer';

/**
 * Hash Service Class
 * Provides hash calculation for change detection
 */
class HashService {
  /**
   * Calculate Product-level hash
   * Hash includes only shared/product-level data
   */
  public calculateProductHash(productData: Partial<ProductData>): string {
    const dataToHash = {
      aNumber: productData.a_number,
      name: productData.name,
      description: productData.description,
      modelName: productData.model_name,
      brand: productData.brand,
      priceTiers: this.normalizePriceTiers(productData.price_tiers),
      // Note: NOT including variant-specific data like colors/sizes
    };

    return this.hashObject(dataToHash);
  }

  /**
   * Calculate Variant-level hash
   * Hash includes variant-specific data
   */
  public calculateVariantHash(variantData: Partial<ProductVariantData>): string {
    const dataToHash = {
      sku: variantData.sku,
      color: variantData.color,
      hexColor: variantData.hex_color,
      size: variantData.size,
      dimensions: {
        length: variantData.dimensions_length,
        width: variantData.dimensions_width,
        height: variantData.dimensions_height,
        diameter: variantData.dimensions_diameter,
        depth: variantData.dimensions_depth,
      },
      weight: variantData.weight,
      material: variantData.material,
      countryOfOrigin: variantData.country_of_origin,
    };

    return this.hashObject(dataToHash);
  }

  /**
   * Calculate hash from raw Promidata data
   * For use in Import.txt comparisons
   */
  public calculateRawHash(rawData: any): string {
    // Use SHA-1 for consistency with Promidata's Import.txt hashes
    const hash = crypto.createHash('sha1');
    hash.update(JSON.stringify(rawData));
    return hash.digest('hex').toUpperCase();
  }

  /**
   * Hash an object using MD5
   */
  private hashObject(obj: any): string {
    // Sort keys for consistent hashing
    const sortedObj = this.sortObjectKeys(obj);
    const jsonString = JSON.stringify(sortedObj);

    const hash = crypto.createHash('md5');
    hash.update(jsonString);
    return hash.digest('hex');
  }

  /**
   * Sort object keys recursively for consistent hashing
   */
  private sortObjectKeys(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectKeys(item));
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    const sortedObj: any = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
      sortedObj[key] = this.sortObjectKeys(obj[key]);
    }

    return sortedObj;
  }

  /**
   * Normalize price tiers for consistent hashing
   * Removes null values and sorts by tier
   */
  private normalizePriceTiers(priceTiers: any): any {
    if (!Array.isArray(priceTiers)) {
      return null;
    }

    return priceTiers
      .map(tier => ({
        tier: tier.tier,
        price: tier.price,
        minQuantity: tier.min_quantity,
      }))
      .sort((a, b) => a.tier - b.tier);
  }

  /**
   * Compare hashes
   */
  public compareHashes(hash1: string, hash2: string): boolean {
    return hash1.toLowerCase() === hash2.toLowerCase();
  }

  /**
   * Batch hash calculation
   * Returns map of identifier → hash
   */
  public calculateBatchProductHashes(
    products: Array<{ aNumber: string; data: Partial<ProductData> }>
  ): Map<string, string> {
    const hashMap = new Map<string, string>();

    for (const product of products) {
      const hash = this.calculateProductHash(product.data);
      hashMap.set(product.aNumber, hash);
    }

    return hashMap;
  }

  /**
   * Batch variant hash calculation
   */
  public calculateBatchVariantHashes(
    variants: Array<{ sku: string; data: Partial<ProductVariantData> }>
  ): Map<string, string> {
    const hashMap = new Map<string, string>();

    for (const variant of variants) {
      const hash = this.calculateVariantHash(variant.data);
      hashMap.set(variant.sku, hash);
    }

    return hashMap;
  }

  /**
   * Extract hash from Import.txt entry
   * Format: url|hash
   */
  public extractImportHash(importLine: string): string | null {
    const parts = importLine.split('|');
    if (parts.length >= 2) {
      return parts[1].trim();
    }
    return null;
  }

  /**
   * Validate hash format
   */
  public isValidHash(hash: string): boolean {
    if (!hash || typeof hash !== 'string') {
      return false;
    }

    // MD5 hash is 32 characters hex
    if (hash.length === 32 && /^[a-f0-9]+$/i.test(hash)) {
      return true;
    }

    // SHA-1 hash is 40 characters hex (Promidata uses this)
    if (hash.length === 40 && /^[a-f0-9]+$/i.test(hash)) {
      return true;
    }

    return false;
  }
}

// Export singleton instance
export default new HashService();
