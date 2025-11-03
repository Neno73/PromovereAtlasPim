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
  short_description?: string;

  // Variant attributes
  color?: string;
  hex_color?: string;
  supplier_color_code?: string;
  supplier_search_color?: string;
  supplier_main_category?: string;
  size?: string;
  sizes?: string[]; // Available sizes for this variant
  material?: string;
  country_of_origin?: string;
  production_time?: string;

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
      short_description: this.extractShortDescription(variantData),
      color: colorName,
      hex_color: this.extractHexColor(variantData),
      supplier_color_code: this.extractColorCode(variantData),
      supplier_search_color: this.extractSearchColor(variantData),
      supplier_main_category: this.extractSupplierMainCategory(variantData),
      size: sizeName,
      sizes: this.extractAvailableSizes(variantData),
      material: this.extractMaterial(variantData),
      country_of_origin: this.extractCountryOfOrigin(variantData),
      production_time: this.extractProductionTime(variantData),
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
   * NEW: Promidata stores color in NonLanguageDependedProductDetails.SearchColor
   * or in ProductDetails[lang].ConfigurationFields[{ConfigurationName: "Color"}]
   */
  private extractColorName(data: RawProductData): string | undefined {
    // Try NonLanguageDependedProductDetails.SearchColor first (Promidata structure)
    const nonLangDetails = data.NonLanguageDependedProductDetails as any;
    if (nonLangDetails?.SearchColor && nonLangDetails.SearchColor !== 'Undefined') {
      return nonLangDetails.SearchColor;
    }

    // Try ConfigurationFields (Promidata variant structure)
    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;
      // Try each language
      for (const lang of ['nl', 'de', 'en', 'fr', 'es']) {
        const configFields = productDetails[lang]?.ConfigurationFields;
        if (Array.isArray(configFields)) {
          const colorConfig = configFields.find((field: any) =>
            field.ConfigurationName === 'Color' ||
            field.ConfigurationNameTranslated === 'Kleur'
          );
          if (colorConfig?.ConfigurationValue) {
            return colorConfig.ConfigurationValue;
          }
        }
      }
    }

    // Fallback to direct fields (legacy support)
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
   * NEW: Promidata stores in NonLanguageDependedProductDetails.SearchColor
   */
  private extractSearchColor(data: RawProductData): string | undefined {
    // Try NonLanguageDependedProductDetails first (Promidata structure)
    const nonLangDetails = data.NonLanguageDependedProductDetails as any;
    if (nonLangDetails?.SearchColor && nonLangDetails.SearchColor !== 'Undefined') {
      return nonLangDetails.SearchColor;
    }

    // Fallback to direct fields (legacy support)
    return data.search_color || data.SearchColor || data.searchColor;
  }

  /**
   * Extract size
   * NEW: Promidata stores size in ProductDetails[lang].ConfigurationFields[{ConfigurationName: "Size"}]
   */
  private extractSize(data: RawProductData): string | undefined {
    // Try ConfigurationFields (Promidata variant structure)
    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;
      // Try each language
      for (const lang of ['nl', 'de', 'en', 'fr', 'es']) {
        const configFields = productDetails[lang]?.ConfigurationFields;
        if (Array.isArray(configFields)) {
          const sizeConfig = configFields.find((field: any) =>
            field.ConfigurationName === 'Size' ||
            field.ConfigurationNameTranslated === 'Afmeting' ||
            field.ConfigurationNameTranslated === 'Größe'
          );
          if (sizeConfig?.ConfigurationValue) {
            return sizeConfig.ConfigurationValue;
          }
        }
      }
    }

    // Fallback to direct fields (legacy support)
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
   * NEW: Promidata stores in ProductDetails[lang].WebShopInformation.Material.InformationValue
   */
  private extractMaterial(data: RawProductData): string | undefined {
    // Try Promidata ProductDetails.WebShopInformation.Material structure first
    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;

      // Try each language
      for (const lang of ['nl', 'de', 'en', 'fr', 'es']) {
        const webShopInfo = productDetails[lang]?.WebShopInformation;
        if (webShopInfo?.Material?.InformationValue) {
          return webShopInfo.Material.InformationValue;
        }
      }
    }

    // FALLBACK: Try direct fields (legacy support)
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
   * NEW: Promidata stores in NonLanguageDependedProductDetails.CountryOfOrigin
   */
  private extractCountryOfOrigin(data: RawProductData): string | undefined {
    // Try NonLanguageDependedProductDetails first (Promidata structure)
    const nonLangDetails = data.NonLanguageDependedProductDetails as any;
    if (nonLangDetails?.CountryOfOrigin) {
      return nonLangDetails.CountryOfOrigin;
    }

    // Fallback to direct fields (legacy support)
    return (
      data.country_of_origin ||
      data.CountryOfOrigin ||
      data.countryOfOrigin ||
      data.origin_country
    );
  }

  /**
   * Extract dimension value
   * NEW: Promidata stores dimensions in NonLanguageDependedProductDetails.Dimensions*
   */
  private extractDimension(
    data: RawProductData,
    dimension: 'length' | 'width' | 'height' | 'diameter' | 'depth'
  ): number | undefined {
    // Try NonLanguageDependedProductDetails first (Promidata structure)
    const nonLangDetails = data.NonLanguageDependedProductDetails as any;
    if (nonLangDetails) {
      const dimensionMap: Record<string, string> = {
        length: 'DimensionsLength',
        width: 'DimensionsWidth',
        height: 'DimensionsHeight',
        diameter: 'DimensionsDiameter',
        depth: 'DimensionsDepth',
      };

      const promidataKey = dimensionMap[dimension];
      if (nonLangDetails[promidataKey] !== undefined && nonLangDetails[promidataKey] !== null) {
        const parsed = parseFloat(nonLangDetails[promidataKey]);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
    }

    // Fallback to direct fields (legacy support)
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
   * NEW: Promidata stores weight in NonLanguageDependedProductDetails.Weight
   */
  private extractWeight(data: RawProductData): number | undefined {
    // Try NonLanguageDependedProductDetails first (Promidata structure)
    const nonLangDetails = data.NonLanguageDependedProductDetails as any;
    if (nonLangDetails?.Weight !== undefined && nonLangDetails.Weight !== null) {
      const parsed = parseFloat(nonLangDetails.Weight);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }

    // Fallback to direct fields (legacy support)
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
   * NEW: Promidata stores description in ProductDetails[lang].Description
   */
  private extractDescription(data: RawProductData): string | undefined {
    // Try ProductDetails structure (Promidata format)
    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;

      // Try English first, then other languages
      for (const lang of ['en', 'nl', 'de', 'fr', 'es']) {
        if (productDetails[lang]?.Description) {
          return productDetails[lang].Description;
        }
      }
    }

    // Fallback to direct fields (legacy support)
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
   * NEW: Promidata stores in ProductDetails[lang].Image.Url and MediaGalleryImages
   */
  public extractImageUrls(data: RawProductData): {
    primaryImage?: string;
    galleryImages: string[];
  } {
    const result: any = {
      galleryImages: [],
    };

    // Try Promidata ProductDetails structure first
    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;

      // Try each language for primary image
      for (const lang of ['nl', 'de', 'en', 'fr', 'es']) {
        if (productDetails[lang]?.Image?.Url && !result.primaryImage) {
          result.primaryImage = productDetails[lang].Image.Url;
        }

        // Extract gallery images from MediaGalleryImages
        if (productDetails[lang]?.MediaGalleryImages) {
          const mediaGallery = productDetails[lang].MediaGalleryImages;
          if (Array.isArray(mediaGallery)) {
            for (const mediaItem of mediaGallery) {
              if (mediaItem?.Url && typeof mediaItem.Url === 'string') {
                result.galleryImages.push(mediaItem.Url);
              }
            }
          }
        }
      }

      // If we found images, return them
      if (result.primaryImage || result.galleryImages.length > 0) {
        return result;
      }
    }

    // FALLBACK: Try legacy direct fields
    if (data.primary_image || data.PrimaryImage || data.primaryImage || data.image) {
      result.primaryImage = data.primary_image || data.PrimaryImage || data.primaryImage || data.image;
    }

    if (data.gallery_images || data.GalleryImages || data.Images || data.images) {
      const images = data.gallery_images || data.GalleryImages || data.Images || data.images;
      if (Array.isArray(images)) {
        result.galleryImages = images.filter(img => typeof img === 'string');
      }
    }

    return result;
  }

  /**
   * Extract short description from Promidata structure
   */
  private extractShortDescription(data: RawProductData): string | undefined {
    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;
      // Try each language, prioritize English
      for (const lang of ['en', 'nl', 'de', 'fr', 'es']) {
        if (productDetails[lang]?.ShortDescription) {
          return productDetails[lang].ShortDescription;
        }
      }
    }
    return undefined;
  }

  /**
   * Extract supplier main category from Promidata structure
   */
  private extractSupplierMainCategory(data: RawProductData): string | undefined {
    return data.NonLanguageDependedProductDetails?.Category;
  }

  /**
   * Extract production time from Promidata structure
   */
  private extractProductionTime(data: RawProductData): string | undefined {
    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;
      // Try each language
      for (const lang of ['en', 'nl', 'de', 'fr', 'es']) {
        if (productDetails[lang]?.ProductionTime) {
          return productDetails[lang].ProductionTime;
        }
        // Fallback to DeliveryTime
        if (productDetails[lang]?.DeliveryTime) {
          return productDetails[lang].DeliveryTime;
        }
      }
    }
    return undefined;
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
