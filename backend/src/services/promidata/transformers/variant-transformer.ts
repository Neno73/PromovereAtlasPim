/**
 * Product Variant Transformer
 * Transforms raw Promidata data into ProductVariant entities
 */

import { RawProductData } from '../parsers/product-parser';

/**
 * Transformed Product Variant Data (matches Strapi ProductVariant schema)
 */
export interface ProductVariantData {
  // Core fields
  sku: string;
  product?: number; // Product ID (will be set during sync)
  name: string;
  description?: string;

  // Variant attributes
  color?: string;
  hex_color?: string;
  supplier_color_code?: string;
  supplier_search_color?: string;
  size?: string;
  sizes?: string[]; // Available sizes for this variant
  material?: string;
  country_of_origin?: string;

  // Flattened dimensions
  dimensions_length?: number;
  dimensions_width?: number;
  dimensions_height?: number;
  dimensions_diameter?: number;
  dimensions_depth?: number;
  weight?: number;

  // Embroidery/Imprint
  embroidery_sizes?: any;
  imprint_required?: boolean;
  fragile?: boolean;
  is_service_base?: boolean;

  // Images (media IDs, will be uploaded separately)
  primary_image?: number;
  gallery_images?: number[];
  information_files?: number[];

  // SEO fields
  meta_name?: string;
  meta_description?: string;
  meta_keywords?: string;

  // Flags
  is_primary_for_color?: boolean;
  is_active?: boolean;
}

/**
 * Product Variant Transformer Class
 */
class VariantTransformer {
  /**
   * Transform raw variant data to ProductVariant entity
   */
  public transform(
    variantData: RawProductData,
    productId: number,
    productName: Record<string, string>,
    isPrimaryForColor: boolean = false
  ): ProductVariantData {
    const colorName = this.extractColorName(variantData);
    const sizeName = this.extractSize(variantData);

    return {
      sku: this.extractSku(variantData),
      product: productId,
      name: this.buildVariantName(productName, colorName, sizeName),
      description: this.extractDescription(variantData),
      color: colorName,
      hex_color: this.extractHexColor(variantData),
      supplier_color_code: this.extractColorCode(variantData),
      supplier_search_color: this.extractSearchColor(variantData),
      size: sizeName,
      sizes: this.extractAvailableSizes(variantData),
      material: this.extractMaterial(variantData),
      country_of_origin: this.extractCountryOfOrigin(variantData),
      dimensions_length: this.extractDimension(variantData, 'length'),
      dimensions_width: this.extractDimension(variantData, 'width'),
      dimensions_height: this.extractDimension(variantData, 'height'),
      dimensions_diameter: this.extractDimension(variantData, 'diameter'),
      dimensions_depth: this.extractDimension(variantData, 'depth'),
      weight: this.extractWeight(variantData),
      embroidery_sizes: this.extractEmbroiderySizes(variantData),
      imprint_required: this.extractImprintRequired(variantData),
      fragile: this.extractFragile(variantData),
      is_service_base: this.extractIsServiceBase(variantData),
      meta_name: this.buildMetaName(productName, colorName, sizeName),
      meta_description: this.buildMetaDescription(productName, colorName, sizeName),
      meta_keywords: this.buildMetaKeywords(productName, colorName, sizeName),
      is_primary_for_color: isPrimaryForColor,
      is_active: true,
    };
  }

  /**
   * Extract SKU
   */
  private extractSku(data: RawProductData): string {
    return data.SKU || data.sku || data.Sku || '';
  }

  /**
   * Extract color name (handles multilingual)
   */
  private extractColorName(data: RawProductData): string | undefined {
    const colorName = data.color_name || data.ColorName || data.colorName;

    if (!colorName) {
      return undefined;
    }

    // If multilingual object, get English version
    if (typeof colorName === 'object' && colorName.en) {
      return colorName.en;
    }

    // If string, return as-is
    if (typeof colorName === 'string') {
      return colorName;
    }

    return undefined;
  }

  /**
   * Extract hex color
   */
  private extractHexColor(data: RawProductData): string | undefined {
    return data.hex_color || data.HexColor || data.hexColor || data.color_hex;
  }

  /**
   * Extract color code
   */
  private extractColorCode(data: RawProductData): string | undefined {
    return data.color_code || data.ColorCode || data.colorCode;
  }

  /**
   * Extract search color
   */
  private extractSearchColor(data: RawProductData): string | undefined {
    return data.search_color || data.SearchColor || data.searchColor;
  }

  /**
   * Extract size
   */
  private extractSize(data: RawProductData): string | undefined {
    return data.size || data.Size || data.SIZE;
  }

  /**
   * Extract available sizes
   */
  private extractAvailableSizes(data: RawProductData): string[] | undefined {
    const sizes = data.available_sizes || data.AvailableSizes || data.sizes || data.Sizes;

    if (Array.isArray(sizes)) {
      return sizes.filter(s => typeof s === 'string');
    }

    // If single size, return as array
    const singleSize = this.extractSize(data);
    return singleSize ? [singleSize] : undefined;
  }

  /**
   * Extract material (handles multilingual)
   */
  private extractMaterial(data: RawProductData): string | undefined {
    const material = data.material || data.Material || data.MATERIAL;

    if (!material) {
      return undefined;
    }

    // If multilingual object, get English version
    if (typeof material === 'object' && material.en) {
      return material.en;
    }

    // If string, return as-is
    if (typeof material === 'string') {
      return material;
    }

    return undefined;
  }

  /**
   * Extract country of origin
   */
  private extractCountryOfOrigin(data: RawProductData): string | undefined {
    return (
      data.country_of_origin ||
      data.CountryOfOrigin ||
      data.countryOfOrigin ||
      data.origin_country
    );
  }

  /**
   * Extract dimension value
   */
  private extractDimension(
    data: RawProductData,
    dimension: 'length' | 'width' | 'height' | 'diameter' | 'depth'
  ): number | undefined {
    const capitalize = dimension.charAt(0).toUpperCase() + dimension.slice(1);
    const upper = dimension.toUpperCase();

    const value = data[dimension] || data[capitalize] || data[upper];

    if (value === undefined || value === null) {
      return undefined;
    }

    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
  }

  /**
   * Extract weight
   */
  private extractWeight(data: RawProductData): number | undefined {
    const weight = data.weight || data.Weight || data.WEIGHT;

    if (weight === undefined || weight === null) {
      return undefined;
    }

    const parsed = parseFloat(weight);
    return isNaN(parsed) ? undefined : parsed;
  }

  /**
   * Extract embroidery sizes
   */
  private extractEmbroiderySizes(data: RawProductData): any {
    return data.embroidery_sizes || data.EmbroiderySizes || data.embroiderySizes;
  }

  /**
   * Extract imprint required flag
   */
  private extractImprintRequired(data: RawProductData): boolean {
    const value = data.imprint_required || data.ImprintRequired || data.imprintRequired;
    return value === true || value === 'true' || value === '1' || value === 1;
  }

  /**
   * Extract fragile flag
   */
  private extractFragile(data: RawProductData): boolean {
    const value = data.fragile || data.Fragile || data.FRAGILE;
    return value === true || value === 'true' || value === '1' || value === 1;
  }

  /**
   * Extract is service base flag
   */
  private extractIsServiceBase(data: RawProductData): boolean {
    const value = data.is_service_base || data.IsServiceBase || data.isServiceBase;
    return value === true || value === 'true' || value === '1' || value === 1;
  }

  /**
   * Extract description
   */
  private extractDescription(data: RawProductData): string | undefined {
    const description = data.Description || data.description || data.DESC;

    if (!description) {
      return undefined;
    }

    // If multilingual object, get English version
    if (typeof description === 'object' && description.en) {
      return description.en;
    }

    // If string, return as-is
    if (typeof description === 'string') {
      return description;
    }

    return undefined;
  }

  /**
   * Build variant name
   * Format: "Product Name - Color - Size"
   */
  private buildVariantName(
    productName: Record<string, string>,
    color?: string,
    size?: string
  ): string {
    const baseName = productName.en || productName.nl || 'Product';
    const parts = [baseName];

    if (color) {
      parts.push(color);
    }

    if (size) {
      parts.push(size);
    }

    return parts.join(' - ');
  }

  /**
   * Build meta name for SEO
   */
  private buildMetaName(
    productName: Record<string, string>,
    color?: string,
    size?: string
  ): string {
    return this.buildVariantName(productName, color, size);
  }

  /**
   * Build meta description for SEO
   */
  private buildMetaDescription(
    productName: Record<string, string>,
    color?: string,
    size?: string
  ): string {
    const baseName = productName.en || productName.nl || 'Product';
    let description = baseName;

    if (color && size) {
      description = `${baseName} in ${color}, size ${size}`;
    } else if (color) {
      description = `${baseName} in ${color}`;
    } else if (size) {
      description = `${baseName}, size ${size}`;
    }

    return description;
  }

  /**
   * Build meta keywords for SEO
   */
  private buildMetaKeywords(
    productName: Record<string, string>,
    color?: string,
    size?: string
  ): string {
    const keywords = [];
    const baseName = productName.en || productName.nl || '';

    if (baseName) {
      keywords.push(baseName);
    }

    if (color) {
      keywords.push(color);
    }

    if (size) {
      keywords.push(size);
    }

    return keywords.join(', ');
  }

  /**
   * Extract image URLs (for later upload)
   */
  public extractImageUrls(data: RawProductData): {
    primaryImage?: string;
    galleryImages: string[];
  } {
    const result: any = {
      galleryImages: [],
    };

    // Primary image (variant-specific)
    if (data.primary_image || data.PrimaryImage || data.primaryImage || data.image) {
      result.primaryImage = data.primary_image || data.PrimaryImage || data.primaryImage || data.image;
    }

    // Gallery images
    if (data.gallery_images || data.GalleryImages || data.Images || data.images) {
      const images = data.gallery_images || data.GalleryImages || data.Images || data.images;
      if (Array.isArray(images)) {
        result.galleryImages = images.filter(img => typeof img === 'string');
      }
    }

    return result;
  }

  /**
   * Validate transformed variant data
   */
  public validate(data: ProductVariantData): boolean {
    if (!data.sku) {
      strapi.log.error('[VariantTransformer] Missing SKU');
      return false;
    }

    if (!data.name) {
      strapi.log.error('[VariantTransformer] Missing name');
      return false;
    }

    if (!data.product) {
      strapi.log.error('[VariantTransformer] Missing product ID');
      return false;
    }

    return true;
  }
}

// Export singleton instance
export default new VariantTransformer();
