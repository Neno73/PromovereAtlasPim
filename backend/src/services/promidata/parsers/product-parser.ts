/**
 * Product Parser
 * Parses Promidata product JSON data
 */

import promidataClient from '../api/promidata-client';

/**
 * Raw Product Data (as received from Promidata)
 * This is a flexible type since Promidata structure varies
 */
export interface RawProductData {
  [key: string]: any;
  // Common fields (not exhaustive)
  SKU?: string;
  ChildProducts?: RawProductData[];
  Name?: any; // Can be string or object with language keys
  Description?: any;
  Images?: string[];
  Price?: any;
  // Many more fields...
}

/**
 * Product Parser Class
 */
class ProductParser {
  /**
   * Fetch and parse product JSON from URL
   */
  public async fetchAndParse(productUrl: string): Promise<RawProductData> {
    try {
      const data = await promidataClient.fetchJSON<any>(productUrl);
      return this.normalizeProductData(data);
    } catch (error) {
      console.error(`[ProductParser] Failed to fetch product from ${productUrl}:`, error);
      throw error;
    }
  }

  /**
   * Normalize product data structure
   * Handles different JSON response formats from Promidata
   */
  private normalizeProductData(jsonData: any): RawProductData {
    // If already an object with expected structure, return as-is
    if (this.isValidProductData(jsonData)) {
      return jsonData;
    }

    // Handle array response (take first item)
    if (Array.isArray(jsonData) && jsonData.length > 0) {
      return jsonData[0];
    }

    // Handle wrapped responses
    if (jsonData.product) {
      return jsonData.product;
    }

    if (jsonData.data) {
      if (Array.isArray(jsonData.data) && jsonData.data.length > 0) {
        return jsonData.data[0];
      }
      if (typeof jsonData.data === 'object') {
        return jsonData.data;
      }
    }

    // Handle object with nested product data
    if (typeof jsonData === 'object' && jsonData !== null) {
      // Look for first object value that looks like product data
      const values = Object.values(jsonData);
      for (const value of values) {
        if (this.isValidProductData(value)) {
          return value as RawProductData;
        }
      }
    }

    // Fallback: return as-is and let transformer handle it
    return jsonData;
  }

  /**
   * Check if data looks like valid product data
   */
  private isValidProductData(data: any): boolean {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    // Check for common product fields
    const hasCommonFields = (
      data.SKU ||
      data.sku ||
      data.Name ||
      data.name ||
      data.ChildProducts ||
      data.childProducts
    );

    return !!hasCommonFields;
  }

  /**
   * Extract child products from parent product
   * Products can have a ChildProducts array for variants
   */
  public extractChildProducts(productData: RawProductData): RawProductData[] {
    if (productData.ChildProducts && Array.isArray(productData.ChildProducts)) {
      return productData.ChildProducts;
    }

    if (productData.childProducts && Array.isArray(productData.childProducts)) {
      return productData.childProducts;
    }

    // If no child products, return parent as single-item array
    return [productData];
  }

  /**
   * Check if product has variants (child products)
   */
  public hasChildProducts(productData: RawProductData): boolean {
    const children = this.extractChildProducts(productData);
    return children.length > 1 || (children.length === 1 && children[0] !== productData);
  }

  /**
   * Parse multilingual field
   * Handles both string and object with language keys {en, nl, de, fr}
   */
  public parseMultilingualField(field: any): Record<string, string> | null {
    if (!field) {
      return null;
    }

    // If already an object with language keys
    if (typeof field === 'object' && !Array.isArray(field)) {
      return field as Record<string, string>;
    }

    // If string, use as default for all languages
    if (typeof field === 'string') {
      return {
        en: field,
        nl: field,
        de: field,
        fr: field,
      };
    }

    return null;
  }

  /**
   * Extract A-Number from product data
   * Used for grouping variants into product families
   */
  public extractANumber(productData: RawProductData): string | null {
    // Try different field names
    return (
      productData.a_number ||
      productData.ANumber ||
      productData.A_Number ||
      productData.model ||
      productData.Model ||
      null
    );
  }

  /**
   * Batch fetch and parse multiple products
   */
  public async fetchAndParseBatch(
    productUrls: string[],
    concurrency: number = 5
  ): Promise<Map<string, RawProductData>> {
    const results = new Map<string, RawProductData>();
    const batches = this.chunk(productUrls, concurrency);

    for (const batch of batches) {
      const promises = batch.map(async (url) => {
        try {
          const data = await this.fetchAndParse(url);
          results.set(url, data);
        } catch (error) {
          console.error(`[ProductParser] Failed to fetch ${url}:`, error.message);
          // Continue with other products
        }
      });

      await Promise.all(promises);
    }

    console.log(`[ProductParser] Fetched ${results.size}/${productUrls.length} products successfully`);
    return results;
  }

  /**
   * Chunk array into batches
   */
  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Export singleton instance
export default new ProductParser();
