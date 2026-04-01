/**
 * Product Transformer
 * Transforms raw Promidata data into Product entities (Product schema)
 */

import { RawProductData } from '../parsers/product-parser';
import { SUPPLIER_NAMES } from '../data/supplier-names';

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
  category?: string;

  // Multilingual fields (JSON)
  name: Record<string, string>;
  description?: Record<string, string>;
  short_description?: Record<string, string>;
  material?: Record<string, string>;
  customization?: Record<string, string>;
  refining?: Record<string, string>;
  refining_dimensions?: Record<string, string>;
  refining_location?: Record<string, string>;
  web_shop_info?: Record<string, any>;
  product_filters?: Record<string, any>;

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
  hex_colors?: string[];
  price_min?: number;
  price_max?: number;
  ean?: string;
  minimum_order_quantity?: number;
  quantity_increments?: number;
  price_region?: string;
  country_of_origin?: string;
  delivery_time?: string;
  customs_tariff_number?: string;
  tax?: 'H' | 'L';
  must_have_imprint?: boolean;
  maxcolors?: number;
  print_option_group?: string;
  default_products?: string;
  battery_information?: string;
  required_certificates?: string;

  // Relations
  supplier?: number; // Supplier ID
  categories?: number[]; // Category IDs

  // Metadata
  promidata_hash?: string;
  last_synced?: Date;
  is_active?: boolean;
  rag_metadata?: Record<string, any>;
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
    supplierCode: string,
    productHash: string
  ): ProductData {
    // Use first variant as base for shared data
    const baseVariant = variants[0];

    return {
      sku: aNumber,
      a_number: aNumber,
      supplier_sku: this.extractSupplierSku(baseVariant),
      supplier_name: this.extractSupplierName(baseVariant, supplierCode),
      brand: this.extractBrand(baseVariant),
      category: this.extractCategory(baseVariant),
      name: this.extractMultilingualName(baseVariant),
      description: this.extractMultilingualDescription(baseVariant),
      short_description: this.extractMultilingualShortDescription(baseVariant),
      material: this.extractMultilingualMaterial(baseVariant),
      customization: this.extractCustomization(baseVariant),
      refining: this.extractRefining(baseVariant),
      refining_dimensions: this.extractRefiningDimensions(baseVariant),
      refining_location: this.extractRefiningLocation(baseVariant),
      web_shop_info: this.extractWebShopInfo(baseVariant),
      product_filters: this.extractProductFilters(baseVariant),
      price_tiers: this.extractPriceTiers(baseVariant),
      dimensions: this.extractDimensions(baseVariant),
      ean: this.extractEan(variants),
      minimum_order_quantity: this.extractMinimumOrderQuantity(baseVariant),
      quantity_increments: this.extractQuantityIncrements(baseVariant),
      price_region: this.extractPriceRegion(baseVariant),
      country_of_origin: this.extractCountryOfOrigin(baseVariant),
      delivery_time: this.extractDeliveryTime(baseVariant),
      customs_tariff_number: this.extractCustomsTariffNumber(baseVariant),
      tax: this.extractTax(baseVariant),
      must_have_imprint: this.extractMustHaveImprint(baseVariant),
      maxcolors: this.extractMaxColors(baseVariant),
      print_option_group: this.extractPrintOptionGroup(baseVariant),
      default_products: this.extractDefaultProducts(baseVariant),
      battery_information: this.extractBatteryInformation(baseVariant),
      required_certificates: this.extractRequiredCertificates(baseVariant),
      total_variants_count: variants.length,
      available_colors: this.extractAvailableColors(variants),
      available_sizes: this.extractAvailableSizes(variants),
      hex_colors: this.extractAvailableHexColors(variants),
      price_min: this.calculateMinPrice(baseVariant),
      price_max: this.calculateMaxPrice(baseVariant),
      supplier: supplierId,
      promidata_hash: productHash,
      last_synced: new Date(),
      is_active: true,
      rag_metadata: {},
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
   * Extract supplier name from static map, Promidata data, or legacy fields
   */
  private extractSupplierName(data: RawProductData, supplierCode: string): string | undefined {
    // 1. Static map (most reliable — maintained manually)
    if (SUPPLIER_NAMES[supplierCode]) return SUPPLIER_NAMES[supplierCode];

    // 2. Promidata UnstructuredInformation.SupplierNameToShow
    const unstructured = (data as any).UnstructuredInformation;
    if (unstructured?.SupplierNameToShow) return unstructured.SupplierNameToShow;

    // 3. Legacy fallback
    return data.supplier_name || data.SupplierName || undefined;
  }

  /**
   * Extract brand
   * NEW: Promidata stores brand in NonLanguageDependedProductDetails.Brand
   */
  private extractBrand(data: RawProductData): string | undefined {
    // Try NonLanguageDependedProductDetails first (Promidata structure)
    if (data.NonLanguageDependedProductDetails?.Brand) {
      return data.NonLanguageDependedProductDetails.Brand;
    }

    // Fallback to direct fields (legacy support)
    return (
      data.brand ||
      data.Brand ||
      data.BRAND
    );
  }

  /**
   * Extract multilingual name
   * NEW: Promidata stores multilingual fields in ProductDetails[lang].Name
   */
  private extractMultilingualName(data: RawProductData): Record<string, string> {
    const result: Record<string, string> = {};

    // Try ProductDetails structure (Promidata format)
    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;

      // Extract from each language
      for (const lang of ['nl', 'de', 'en', 'fr', 'es']) {
        if (productDetails[lang]?.Name) {
          result[lang] = productDetails[lang].Name;
        }
      }

      // If we found at least one language, return it
      if (Object.keys(result).length > 0) {
        return result;
      }
    }

    // Fallback: Try direct field (legacy support)
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
   * NEW: Promidata stores multilingual fields in ProductDetails[lang].Description
   */
  private extractMultilingualDescription(data: RawProductData): Record<string, string> | undefined {
    const result: Record<string, string> = {};

    // Try ProductDetails structure (Promidata format)
    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;

      // Extract from each language
      for (const lang of ['nl', 'de', 'en', 'fr', 'es']) {
        if (productDetails[lang]?.Description) {
          result[lang] = productDetails[lang].Description;
        }
      }

      // If we found at least one language, return it
      if (Object.keys(result).length > 0) {
        return result;
      }
    }

    // Fallback: Try direct field (legacy support)
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
   * Select the pricing region for this product.
   * Priority: BENELUX > EURO > first available.
   */
  private selectPriceRegion(data: RawProductData): { region: string; regionData: any } | null {
    const prices = (data as any).ProductPriceCountryBased;
    if (!prices || typeof prices !== 'object') return null;

    for (const preferred of ['BENELUX', 'EURO']) {
      if (prices[preferred]) return { region: preferred, regionData: prices[preferred] };
    }
    const firstKey = Object.keys(prices)[0];
    return firstKey ? { region: firstKey, regionData: prices[firstKey] } : null;
  }

  /**
   * Extract price tiers from ProductPriceCountryBased
   * Reads from ProductPriceCountryBased[region].RecommendedSellingPrice[] and GeneralBuyingPrice[].
   * Returns empty array (not undefined) for Strapi 5 repeatable component compatibility.
   */
  private extractPriceTiers(data: RawProductData): any[] {
    const regionInfo = this.selectPriceRegion(data);
    if (!regionInfo) return [];

    const { region, regionData } = regionInfo;
    const tiers: any[] = [];
    const sellingPrices = regionData.RecommendedSellingPrice || [];
    const buyingPrices = regionData.GeneralBuyingPrice || [];

    for (const sp of sellingPrices) {
      if (sp.OnRequest) continue;
      const price = parseFloat(sp.Price);
      if (isNaN(price) || price <= 0) continue;

      const tier: any = {
        quantity: parseInt(sp.Quantity) || 1,
        price,
        currency: (sp.Valuta === 'EURO' ? 'EUR' : sp.Valuta) || 'EUR',
        price_type: 'selling',
        region,
      };

      // Match buying price for same quantity
      const bp = buyingPrices.find((b: any) => b.Quantity === sp.Quantity && !b.OnRequest);
      if (bp) {
        const buyPrice = parseFloat(bp.Price);
        if (!isNaN(buyPrice) && buyPrice > 0) {
          tier.buying_price = buyPrice;
        }
      }

      tiers.push(tier);
    }

    return tiers;
  }

  /**
   * Extract dimensions (average from first variant)
   * NEW: Promidata stores dimensions in NonLanguageDependedProductDetails.Dimensions*
   */
  private extractDimensions(data: RawProductData): any {
    const dimensions: any = {};
    const nonLangDetails = data.NonLanguageDependedProductDetails as any;

    // Try NonLanguageDependedProductDetails first (Promidata structure)
    if (nonLangDetails) {
      if (nonLangDetails.DimensionsLength) {
        dimensions.length = parseFloat(nonLangDetails.DimensionsLength);
      }
      if (nonLangDetails.DimensionsWidth) {
        dimensions.width = parseFloat(nonLangDetails.DimensionsWidth);
      }
      if (nonLangDetails.DimensionsHeight) {
        dimensions.height = parseFloat(nonLangDetails.DimensionsHeight);
      }
      if (nonLangDetails.DimensionsDiameter) {
        dimensions.diameter = parseFloat(nonLangDetails.DimensionsDiameter);
      }
      if (nonLangDetails.DimensionsDepth) {
        dimensions.depth = parseFloat(nonLangDetails.DimensionsDepth);
      }
      if (nonLangDetails.Weight) {
        dimensions.weight = parseFloat(nonLangDetails.Weight);
      }
    }

    // Fallback to direct fields (legacy support)
    if (Object.keys(dimensions).length === 0) {
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
   * NEW: Promidata stores color in NonLanguageDependedProductDetails.SearchColor
   * or in ProductDetails[lang].ConfigurationFields[{ConfigurationName: "Color"}]
   */
  private extractColorName(data: RawProductData): string | null {
    // Try NonLanguageDependedProductDetails.SearchColor first (Promidata structure)
    const nonLangDetails = (data as any).NonLanguageDependedProductDetails;
    if (nonLangDetails?.SearchColor && nonLangDetails.SearchColor !== 'Undefined') {
      return nonLangDetails.SearchColor;
    }

    // Try ConfigurationFields (Promidata variant structure)
    if ((data as any).ProductDetails) {
      const productDetails = (data as any).ProductDetails;
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

    // FALLBACK: Try legacy direct fields
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
   * NEW: Promidata stores size in ProductDetails[lang].ConfigurationFields[{ConfigurationName: "Size"}]
   */
  private extractSize(data: RawProductData): string | null {
    // Try ConfigurationFields (Promidata variant structure)
    if ((data as any).ProductDetails) {
      const productDetails = (data as any).ProductDetails;
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

    // FALLBACK: Try legacy direct fields
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

    // Try Promidata ProductDetails structure first
    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;

      // Try each language for main image
      for (const lang of ['nl', 'de', 'en', 'fr', 'es']) {
        if (productDetails[lang]?.Image?.Url && !result.mainImage) {
          result.mainImage = productDetails[lang].Image.Url;
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
      if (result.mainImage || result.galleryImages.length > 0) {
        return result;
      }
    }

    // FALLBACK: Try legacy direct fields
    if (data.main_image || data.MainImage || data.mainImage) {
      result.mainImage = data.main_image || data.MainImage || data.mainImage;
    }

    if (data.gallery_images || data.GalleryImages || data.Images) {
      const images = data.gallery_images || data.GalleryImages || data.Images;
      if (Array.isArray(images)) {
        result.galleryImages = images.filter(img => typeof img === 'string');
      }
    }

    if (data.model_image || data.ModelImage || data.modelImage) {
      result.modelImage = data.model_image || data.ModelImage || data.modelImage;
    }

    return result;
  }

  /**
   * Extract category string from Promidata structure
   */
  private extractCategory(data: RawProductData): string | undefined {
    return data.NonLanguageDependedProductDetails?.Category;
  }

  /**
   * Extract multilingual short description
   */
  private extractMultilingualShortDescription(data: RawProductData): Record<string, string> | undefined {
    const result: Record<string, string> = {};

    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;
      for (const lang of ['nl', 'de', 'en', 'fr', 'es']) {
        if (productDetails[lang]?.ShortDescription) {
          result[lang] = productDetails[lang].ShortDescription;
        }
      }
      if (Object.keys(result).length > 0) return result;
    }
    return undefined;
  }

  /**
   * Extract multilingual material information
   */
  private extractMultilingualMaterial(data: RawProductData): Record<string, string> | undefined {
    const result: Record<string, string> = {};

    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;
      for (const lang of ['nl', 'de', 'en', 'fr', 'es']) {
        const webShopInfo = productDetails[lang]?.WebShopInformation;
        if (webShopInfo?.Material?.InformationValue) {
          result[lang] = webShopInfo.Material.InformationValue;
        }
      }
      if (Object.keys(result).length > 0) return result;
    }
    return undefined;
  }

  /**
   * Extract customization options (imprint positions)
   */
  private extractCustomization(data: RawProductData): Record<string, string> | undefined {
    const result: Record<string, string> = {};

    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;
      for (const lang of ['nl', 'de', 'en', 'fr', 'es']) {
        const imprintPositions = productDetails[lang]?.ImprintPositions;
        if (Array.isArray(imprintPositions) && imprintPositions.length > 0) {
          result[lang] = imprintPositions.map(pos => pos.ImprintPositionName).join(', ');
        }
      }
      if (Object.keys(result).length > 0) return result;
    }
    return undefined;
  }

  /**
   * Extract refining/customization options (configuration fields excluding Color/Size)
   */
  private extractRefining(data: RawProductData): Record<string, string> | undefined {
    const result: Record<string, string> = {};

    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;
      for (const lang of ['nl', 'de', 'en', 'fr', 'es']) {
        const configFields = productDetails[lang]?.ConfigurationFields;
        if (Array.isArray(configFields)) {
          const customOptions = configFields
            .filter(field => field.ConfigurationName !== 'Color' && field.ConfigurationName !== 'Size')
            .map(field => `${field.ConfigurationName}: ${field.ConfigurationValue}`)
            .join(', ');
          if (customOptions) result[lang] = customOptions;
        }
      }
      if (Object.keys(result).length > 0) return result;
    }
    return undefined;
  }

  /**
   * Extract refining dimensions (imprint area dimensions)
   */
  private extractRefiningDimensions(data: RawProductData): Record<string, string> | undefined {
    const result: Record<string, string> = {};

    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;
      for (const lang of ['nl', 'de', 'en', 'fr', 'es']) {
        const imprintPositions = productDetails[lang]?.ImprintPositions;
        if (Array.isArray(imprintPositions) && imprintPositions.length > 0) {
          const dimensions = imprintPositions
            .map(pos => `${pos.ImprintPositionName}: ${pos.DimensionWidth}x${pos.DimensionHeight}mm`)
            .join('; ');
          if (dimensions) result[lang] = dimensions;
        }
      }
      if (Object.keys(result).length > 0) return result;
    }
    return undefined;
  }

  /**
   * Extract refining locations (where imprint can be placed)
   */
  private extractRefiningLocation(data: RawProductData): Record<string, string> | undefined {
    const result: Record<string, string> = {};

    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;
      for (const lang of ['nl', 'de', 'en', 'fr', 'es']) {
        const imprintPositions = productDetails[lang]?.ImprintPositions;
        if (Array.isArray(imprintPositions) && imprintPositions.length > 0) {
          result[lang] = imprintPositions.map(pos => pos.ImprintPositionName).join(', ');
        }
      }
      if (Object.keys(result).length > 0) return result;
    }
    return undefined;
  }

  /**
   * Extract web shop information
   */
  private extractWebShopInfo(data: RawProductData): Record<string, any> | undefined {
    const result: Record<string, any> = {};

    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;
      for (const lang of ['nl', 'de', 'en', 'fr', 'es']) {
        if (productDetails[lang]?.WebShopInformation) {
          result[lang] = productDetails[lang].WebShopInformation;
        }
      }
      if (Object.keys(result).length > 0) return result;
    }
    return undefined;
  }

  /**
   * Extract product filters
   */
  private extractProductFilters(data: RawProductData): Record<string, any> | undefined {
    const result: Record<string, any> = {};

    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;
      for (const lang of ['nl', 'de', 'en', 'fr', 'es']) {
        if (productDetails[lang]?.ProductFilters) {
          result[lang] = productDetails[lang].ProductFilters;
        }
      }
      if (Object.keys(result).length > 0) return result;
    }
    return undefined;
  }

  /**
   * Extract country of origin
   */
  private extractCountryOfOrigin(data: RawProductData): string | undefined {
    return data.NonLanguageDependedProductDetails?.CountryOfOrigin;
  }

  /**
   * Extract delivery time
   */
  private extractDeliveryTime(data: RawProductData): string | undefined {
    // Try NonLanguageDependedProductDetails first
    if (data.NonLanguageDependedProductDetails?.DeliveryTime) {
      return data.NonLanguageDependedProductDetails.DeliveryTime;
    }

    // Fallback to ProductDetails
    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;
      for (const lang of ['en', 'nl', 'de', 'fr', 'es']) {
        if (productDetails[lang]?.DeliveryTime) {
          return productDetails[lang].DeliveryTime;
        }
      }
    }
    return undefined;
  }

  /**
   * Extract customs tariff number
   */
  private extractCustomsTariffNumber(data: RawProductData): string | undefined {
    return data.NonLanguageDependedProductDetails?.CustomsTariffNumber;
  }

  /**
   * Extract tax indicator (H = High, L = Low)
   */
  private extractTax(data: RawProductData): 'H' | 'L' | undefined {
    // Check pricing structure for tax indicator
    if (data.PriceDetails && Array.isArray(data.PriceDetails) && data.PriceDetails.length > 0) {
      const taxIndicator = data.PriceDetails[0].PriceTaxIndicator;
      if (taxIndicator === 'H' || taxIndicator === 'L') {
        return taxIndicator;
      }
    }
    return undefined;
  }

  /**
   * Extract must have imprint flag
   */
  private extractMustHaveImprint(data: RawProductData): boolean {
    const value = data.NonLanguageDependedProductDetails?.MustHaveImprint;
    return value === true || value === 'true' || value === '1' || value === 1;
  }

  /**
   * Extract maximum colors for imprint
   */
  private extractMaxColors(data: RawProductData): number | undefined {
    // Check imprint positions for max colors
    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;
      for (const lang of ['nl', 'de', 'en', 'fr', 'es']) {
        const imprintPositions = productDetails[lang]?.ImprintPositions;
        if (Array.isArray(imprintPositions) && imprintPositions.length > 0) {
          const maxColors = Math.max(...imprintPositions.map(pos => pos.MaxColors || 0));
          if (maxColors > 0) return maxColors;
        }
      }
    }
    return undefined;
  }

  /**
   * Extract print option group
   */
  private extractPrintOptionGroup(data: RawProductData): string | undefined {
    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;
      for (const lang of ['nl', 'de', 'en', 'fr', 'es']) {
        const imprintPositions = productDetails[lang]?.ImprintPositions;
        if (Array.isArray(imprintPositions) && imprintPositions.length > 0) {
          return imprintPositions[0].PrintOptionGroup;
        }
      }
    }
    return undefined;
  }

  /**
   * Extract default products
   */
  private extractDefaultProducts(data: RawProductData): string | undefined {
    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;
      for (const lang of ['en', 'nl', 'de', 'fr', 'es']) {
        if (productDetails[lang]?.DefaultProducts) {
          return productDetails[lang].DefaultProducts;
        }
      }
    }
    return undefined;
  }

  /**
   * Extract battery information
   */
  private extractBatteryInformation(data: RawProductData): string | undefined {
    // Try top-level BatteryInformation
    if (data.BatteryInformation) {
      return data.BatteryInformation;
    }

    // Try in ProductDetails
    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;
      for (const lang of ['en', 'nl', 'de', 'fr', 'es']) {
        if (productDetails[lang]?.BatteryInformation) {
          return productDetails[lang].BatteryInformation;
        }
      }
    }
    return undefined;
  }

  /**
   * Extract required certificates
   */
  private extractRequiredCertificates(data: RawProductData): string | undefined {
    // Try top-level RequiredCertificates
    if (data.RequiredCertificates) {
      if (Array.isArray(data.RequiredCertificates)) {
        return data.RequiredCertificates.join(', ');
      }
      return data.RequiredCertificates;
    }

    // Try in ProductDetails
    if (data.ProductDetails) {
      const productDetails = data.ProductDetails as any;
      for (const lang of ['en', 'nl', 'de', 'fr', 'es']) {
        if (productDetails[lang]?.RequiredCertificates) {
          const certs = productDetails[lang].RequiredCertificates;
          if (Array.isArray(certs)) {
            return certs.join(', ');
          }
          return certs;
        }
      }
    }
    return undefined;
  }

  /**
   * Extract EAN barcode from first variant with a non-empty value
   */
  private extractEan(variants: RawProductData[]): string | undefined {
    for (const variant of variants) {
      const ean = (variant as any).Ean || variant.ean || variant.EAN;
      if (ean && typeof ean === 'string' && ean.trim()) return ean.trim();
    }
    return undefined;
  }

  /**
   * Extract minimum order quantity from the pricing region
   */
  private extractMinimumOrderQuantity(data: RawProductData): number | undefined {
    const regionInfo = this.selectPriceRegion(data);
    if (!regionInfo) return undefined;
    const moq = regionInfo.regionData.MinimumOrderQuantity;
    return typeof moq === 'number' && moq > 0 ? moq : undefined;
  }

  /**
   * Extract quantity increments from the pricing region
   */
  private extractQuantityIncrements(data: RawProductData): number | undefined {
    const regionInfo = this.selectPriceRegion(data);
    if (!regionInfo) return undefined;
    const qi = regionInfo.regionData.QuantityIncrements;
    return typeof qi === 'number' && qi > 0 ? qi : undefined;
  }

  /**
   * Extract which pricing region was used (BENELUX, EURO, etc.)
   */
  private extractPriceRegion(data: RawProductData): string | undefined {
    const regionInfo = this.selectPriceRegion(data);
    return regionInfo?.region;
  }

  /**
   * Extract available hex colors from all variants.
   * Checks NonLanguageDependedProductDetails.HexColor AND
   * ProductDetails.{lang}.UnstructuredInformation.HexColor (A403 pattern).
   */
  private extractAvailableHexColors(variants: RawProductData[]): string[] {
    const hexColors = new Set<string>();

    for (const variant of variants) {
      let hex: string | null = null;

      // 1. NonLanguageDependedProductDetails.HexColor (usually null but check first)
      const nonLangDetails = (variant as any).NonLanguageDependedProductDetails;
      if (nonLangDetails?.HexColor && nonLangDetails.HexColor !== 'null') {
        hex = nonLangDetails.HexColor;
      }

      // 2. ProductDetails.{lang}.UnstructuredInformation.HexColor (A403 pattern)
      if (!hex && (variant as any).ProductDetails) {
        const pd = (variant as any).ProductDetails;
        for (const lang of ['nl', 'de', 'en', 'fr']) {
          if (pd[lang]?.UnstructuredInformation?.HexColor) {
            hex = pd[lang].UnstructuredInformation.HexColor;
            break;
          }
        }
      }

      // 3. Legacy fallback
      if (!hex) {
        hex = variant.hex_color || variant.HexColor || variant.hexColor || null;
      }

      if (hex && typeof hex === 'string' && hex.trim() && hex !== 'null') {
        hexColors.add(hex.trim());
      }
    }

    return Array.from(hexColors);
  }

  /**
   * Calculate minimum selling price from the selected price region
   */
  private calculateMinPrice(data: RawProductData): number | undefined {
    const regionInfo = this.selectPriceRegion(data);
    if (!regionInfo) return undefined;

    const sellingPrices = regionInfo.regionData.RecommendedSellingPrice || [];
    const prices = sellingPrices
      .filter((p: any) => !p.OnRequest)
      .map((p: any) => parseFloat(p.Price))
      .filter((p: number) => !isNaN(p) && p > 0);

    return prices.length > 0 ? Math.min(...prices) : undefined;
  }

  /**
   * Calculate maximum selling price from the selected price region
   */
  private calculateMaxPrice(data: RawProductData): number | undefined {
    const regionInfo = this.selectPriceRegion(data);
    if (!regionInfo) return undefined;

    const sellingPrices = regionInfo.regionData.RecommendedSellingPrice || [];
    const prices = sellingPrices
      .filter((p: any) => !p.OnRequest)
      .map((p: any) => parseFloat(p.Price))
      .filter((p: number) => !isNaN(p) && p > 0);

    return prices.length > 0 ? Math.max(...prices) : undefined;
  }

  /**
   * Validate transformed product data
   */
  public validate(data: ProductData): boolean {
    if (!data.sku) {
      strapi.log.error('[ProductTransformer] Missing SKU');
      return false;
    }

    if (!data.a_number) {
      strapi.log.error('[ProductTransformer] Missing a_number');
      return false;
    }

    if (!data.name || Object.keys(data.name).length === 0) {
      strapi.log.error('[ProductTransformer] Missing name');
      return false;
    }

    return true;
  }
}

// Export singleton instance
export default new ProductTransformer();
