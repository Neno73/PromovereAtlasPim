/**
 * Product Transformer
 * Transforms raw Promidata data into Product entities (Product schema)
 */

import { RawProductData } from '../parsers/product-parser';

/**
 * Transformed Product Data (matches Strapi Product schema)
 */
export interface ProductData {
  // Core fields
  sku: string;
  a_number: string;
  supplier_sku?: string;
  supplier_name?: string;
  brand?: string;

  // Multilingual fields (JSON)
  name: Record<string, string>;
  description?: Record<string, string>;
  model_name?: Record<string, string>;

  // Pricing (component)
  price_tiers?: any;

  // Dimensions (component)
  dimensions?: any;

  // Images (will be uploaded separately)
  main_image?: number; // Media ID
  gallery_images?: number[]; // Media IDs
  model_image?: number; // Media ID

  // Product info
  total_variants_count?: number;
  available_colors?: string[];
  available_sizes?: string[];

  // Relations
  supplier?: number; // Supplier ID
  categories?: number[]; // Category IDs

  // Metadata
  promidata_hash?: string;
  last_synced?: Date;
  is_active?: boolean;
}

/**
 * Product Transformer Class
 */
class ProductTransformer {
  /**
   * Transform raw product data to Product entity
   * Uses first variant data for shared fields
   */
  public transform(
    aNumber: string,
    variants: RawProductData[],
    supplierId: number,
    productHash: string
  ): ProductData {
    // Use first variant as base for shared data
    const baseVariant = variants[0];

    return {
      sku: aNumber,
      a_number: aNumber,
      supplier_sku: this.extractSupplierSku(baseVariant),
      supplier_name: this.extractSupplierName(baseVariant),
      brand: this.extractBrand(baseVariant),
      name: this.extractMultilingualName(baseVariant),
      description: this.extractMultilingualDescription(baseVariant),
      model_name: this.extractMultilingualModelName(baseVariant),
      price_tiers: this.extractPriceTiers(baseVariant),
      dimensions: this.extractDimensions(baseVariant),
      total_variants_count: variants.length,
      available_colors: this.extractAvailableColors(variants),
      available_sizes: this.extractAvailableSizes(variants),
      supplier: supplierId,
      promidata_hash: productHash,
      last_synced: new Date(),
      is_active: true,
    };
  }

  /**
   * Extract supplier SKU
   */
  private extractSupplierSku(data: RawProductData): string | undefined {
    return (
      data.supplier_sku ||
      data.SupplierSKU ||
      data.supplierSku ||
      data.SKU
    );
  }

  /**
   * Extract supplier name
   */
  private extractSupplierName(data: RawProductData): string | undefined {
    return (
      data.supplier_name ||
      data.SupplierName ||
      data.supplierName ||
      data.Supplier
    );
  }

  /**
   * Extract brand
   */
  private extractBrand(data: RawProductData): string | undefined {
    return (
      data.brand ||
      data.Brand ||
      data.BRAND
    );
  }

  /**
   * Extract multilingual name
   */
  private extractMultilingualName(data: RawProductData): Record<string, string> {
    const name = data.Name || data.name || data.NAME;

    if (!name) {
      return { en: 'Unnamed Product' };
    }

    // If already multilingual object
    if (typeof name === 'object' && !Array.isArray(name)) {
      return name as Record<string, string>;
    }

    // If string, use for all languages
    if (typeof name === 'string') {
      return {
        en: name,
        nl: name,
        de: name,
        fr: name,
      };
    }

    return { en: 'Unnamed Product' };
  }

  /**
   * Extract multilingual description
   */
  private extractMultilingualDescription(data: RawProductData): Record<string, string> | undefined {
    const description = data.Description || data.description || data.DESC;

    if (!description) {
      return undefined;
    }

    // If already multilingual object
    if (typeof description === 'object' && !Array.isArray(description)) {
      return description as Record<string, string>;
    }

    // If string, use for all languages
    if (typeof description === 'string') {
      return {
        en: description,
        nl: description,
        de: description,
        fr: description,
      };
    }

    return undefined;
  }

  /**
   * Extract multilingual model name
   */
  private extractMultilingualModelName(data: RawProductData): Record<string, string> | undefined {
    const modelName = data.model_name || data.ModelName || data.modelName;

    if (!modelName) {
      return undefined;
    }

    // If already multilingual object
    if (typeof modelName === 'object' && !Array.isArray(modelName)) {
      return modelName as Record<string, string>;
    }

    // If string, use for all languages
    if (typeof modelName === 'string') {
      return {
        en: modelName,
        nl: modelName,
        de: modelName,
        fr: modelName,
      };
    }

    return undefined;
  }

  /**
   * Extract price tiers (8-tier structure)
   */
  private extractPriceTiers(data: RawProductData): any {
    const priceTiers = [];

    // Tier 1-8 fields
    for (let i = 1; i <= 8; i++) {
      const price = data[`price_${i}`] || data[`Price${i}`] || data[`PRICE_${i}`];
      const minQty = data[`min_qty_${i}`] || data[`MinQty${i}`] || (i === 1 ? 1 : null);

      if (price !== undefined && price !== null) {
        priceTiers.push({
          tier: i,
          price: parseFloat(price),
          min_quantity: minQty ? parseInt(minQty) : null,
        });
      }
    }

    return priceTiers.length > 0 ? priceTiers : undefined;
  }

  /**
   * Extract dimensions (average from first variant)
   */
  private extractDimensions(data: RawProductData): any {
    const dimensions: any = {};

    // Length
    if (data.length || data.Length || data.LENGTH) {
      dimensions.length = parseFloat(data.length || data.Length || data.LENGTH);
    }

    // Width
    if (data.width || data.Width || data.WIDTH) {
      dimensions.width = parseFloat(data.width || data.Width || data.WIDTH);
    }

    // Height
    if (data.height || data.Height || data.HEIGHT) {
      dimensions.height = parseFloat(data.height || data.Height || data.HEIGHT);
    }

    // Diameter
    if (data.diameter || data.Diameter || data.DIAMETER) {
      dimensions.diameter = parseFloat(data.diameter || data.Diameter || data.DIAMETER);
    }

    // Depth
    if (data.depth || data.Depth || data.DEPTH) {
      dimensions.depth = parseFloat(data.depth || data.Depth || data.DEPTH);
    }

    // Weight
    if (data.weight || data.Weight || data.WEIGHT) {
      dimensions.weight = parseFloat(data.weight || data.Weight || data.WEIGHT);
    }

    return Object.keys(dimensions).length > 0 ? dimensions : undefined;
  }

  /**
   * Extract available colors from all variants
   */
  private extractAvailableColors(variants: RawProductData[]): string[] {
    const colors = new Set<string>();

    for (const variant of variants) {
      const colorName = this.extractColorName(variant);
      if (colorName) {
        colors.add(colorName);
      }
    }

    return Array.from(colors);
  }

  /**
   * Extract color name (handles multilingual)
   */
  private extractColorName(data: RawProductData): string | null {
    const colorName = data.color_name || data.ColorName || data.colorName;

    if (!colorName) {
      return null;
    }

    // If multilingual object, get English version
    if (typeof colorName === 'object' && colorName.en) {
      return colorName.en;
    }

    // If string, return as-is
    if (typeof colorName === 'string') {
      return colorName;
    }

    return null;
  }

  /**
   * Extract available sizes from all variants
   */
  private extractAvailableSizes(variants: RawProductData[]): string[] {
    const sizes = new Set<string>();

    for (const variant of variants) {
      const size = this.extractSize(variant);
      if (size) {
        sizes.add(size);
      }
    }

    return Array.from(sizes).sort();
  }

  /**
   * Extract size
   */
  private extractSize(data: RawProductData): string | null {
    return (
      data.size ||
      data.Size ||
      data.SIZE ||
      null
    );
  }

  /**
   * Extract image URLs (for later upload)
   */
  public extractImageUrls(data: RawProductData): {
    mainImage?: string;
    galleryImages: string[];
    modelImage?: string;
  } {
    const result: any = {
      galleryImages: [],
    };

    // Main image
    if (data.main_image || data.MainImage || data.mainImage) {
      result.mainImage = data.main_image || data.MainImage || data.mainImage;
    }

    // Gallery images
    if (data.gallery_images || data.GalleryImages || data.Images) {
      const images = data.gallery_images || data.GalleryImages || data.Images;
      if (Array.isArray(images)) {
        result.galleryImages = images.filter(img => typeof img === 'string');
      }
    }

    // Model image
    if (data.model_image || data.ModelImage || data.modelImage) {
      result.modelImage = data.model_image || data.ModelImage || data.modelImage;
    }

    return result;
  }

  /**
   * Validate transformed product data
   */
  public validate(data: ProductData): boolean {
    if (!data.sku) {
      console.error('[ProductTransformer] Missing SKU');
      return false;
    }

    if (!data.a_number) {
      console.error('[ProductTransformer] Missing a_number');
      return false;
    }

    if (!data.name || Object.keys(data.name).length === 0) {
      console.error('[ProductTransformer] Missing name');
      return false;
    }

    return true;
  }
}

// Export singleton instance
export default new ProductTransformer();
