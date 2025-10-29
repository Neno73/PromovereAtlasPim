/**
 * Grouping Utilities
 * Groups raw product data by various criteria for hierarchy construction
 */

import { RawProductData } from '../parsers/product-parser';
import { ImportEntry } from '../parsers/import-parser';

/**
 * Product Family Group
 * All variants that belong to the same product family (same a_number)
 */
export interface ProductFamilyGroup {
  aNumber: string;
  variants: RawProductData[];
  importEntries: ImportEntry[];
}

/**
 * Color Group
 * Variants grouped by color within a product family
 */
export interface ColorGroup {
  color: string;
  colorCode: string;
  hexColor?: string;
  variants: RawProductData[];
}

/**
 * Grouping Service
 */
class GroupingService {
  /**
   * Group raw products by a_number (product family)
   * This is the primary grouping for Product → ProductVariant hierarchy
   */
  public groupByANumber(
    products: RawProductData[]
  ): Map<string, RawProductData[]> {
    const grouped = new Map<string, RawProductData[]>();

    for (const product of products) {
      const aNumber = this.extractANumber(product);

      if (!aNumber) {
        strapi.log.warn('[Grouping] Product missing a_number:', product.SKU || 'unknown');
        continue;
      }

      if (!grouped.has(aNumber)) {
        grouped.set(aNumber, []);
      }

      grouped.get(aNumber)!.push(product);
    }

    strapi.log.info(`[Grouping] Grouped ${products.length} products into ${grouped.size} families`);
    return grouped;
  }

  /**
   * Group variants by color
   * Used to identify primary variant for each color
   */
  public groupByColor(variants: RawProductData[]): Map<string, ColorGroup> {
    const grouped = new Map<string, ColorGroup>();

    for (const variant of variants) {
      const colorCode = this.extractColorCode(variant);
      const colorName = this.extractColorName(variant);
      const hexColor = this.extractHexColor(variant);

      // Use color code as key (more reliable than name)
      const key = colorCode || colorName || 'UNKNOWN';

      if (!grouped.has(key)) {
        grouped.set(key, {
          color: colorName || key,
          colorCode: key,
          hexColor,
          variants: [],
        });
      }

      grouped.get(key)!.variants.push(variant);
    }

    return grouped;
  }

  /**
   * Create product family groups with import entries
   */
  public createFamilyGroups(
    importEntries: ImportEntry[],
    productDataMap: Map<string, RawProductData>
  ): ProductFamilyGroup[] {
    const familyMap = new Map<string, ProductFamilyGroup>();

    for (const entry of importEntries) {
      const productData = productDataMap.get(entry.url);
      if (!productData) {
        continue;
      }

      const aNumber = this.extractANumber(productData) || entry.sku;

      if (!familyMap.has(aNumber)) {
        familyMap.set(aNumber, {
          aNumber,
          variants: [],
          importEntries: [],
        });
      }

      const group = familyMap.get(aNumber)!;
      group.variants.push(productData);
      group.importEntries.push(entry);
    }

    return Array.from(familyMap.values());
  }

  /**
   * Extract a_number from product data
   * Tries multiple field names
   */
  private extractANumber(product: RawProductData): string | null {
    return (
      product.a_number ||
      product.ANumber ||
      product.A_Number ||
      product.aNumber ||
      product.model ||
      product.Model ||
      product.ModelNumber ||
      null
    );
  }

  /**
   * Extract color code from product data
   */
  private extractColorCode(product: RawProductData): string | null {
    return (
      product.color_code ||
      product.ColorCode ||
      product.colorCode ||
      product.search_color ||
      product.SearchColor ||
      null
    );
  }

  /**
   * Extract color name from product data
   * Handles multilingual fields
   */
  private extractColorName(product: RawProductData): string | null {
    const colorName = product.color_name || product.ColorName || product.colorName;

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
   * Extract hex color from product data
   */
  private extractHexColor(product: RawProductData): string | null {
    return (
      product.hex_color ||
      product.HexColor ||
      product.hexColor ||
      product.color_hex ||
      null
    );
  }

  /**
   * Sort variants within color group
   * Ensures consistent ordering (primary variant should be first)
   */
  public sortVariantsBySize(variants: RawProductData[]): RawProductData[] {
    // Size priority order (most common first)
    const sizePriority: Record<string, number> = {
      'XS': 1,
      'S': 2,
      'M': 3,
      'L': 4,
      'XL': 5,
      'XXL': 6,
      '3XL': 7,
      '4XL': 8,
      '5XL': 9,
    };

    return [...variants].sort((a, b) => {
      const sizeA = this.extractSize(a);
      const sizeB = this.extractSize(b);

      const priorityA = sizePriority[sizeA] || 999;
      const priorityB = sizePriority[sizeB] || 999;

      return priorityA - priorityB;
    });
  }

  /**
   * Extract size from product data
   */
  private extractSize(product: RawProductData): string {
    return (
      product.size ||
      product.Size ||
      product.SIZE ||
      ''
    );
  }

  /**
   * Get primary variant for each color
   * Returns map of color → primary variant
   */
  public getPrimaryVariants(
    colorGroups: Map<string, ColorGroup>
  ): Map<string, RawProductData> {
    const primaryMap = new Map<string, RawProductData>();

    for (const [color, group] of colorGroups) {
      // Sort variants and take first as primary
      const sorted = this.sortVariantsBySize(group.variants);
      primaryMap.set(color, sorted[0]);
    }

    return primaryMap;
  }

  /**
   * Check if variants should be consolidated into single product
   * (They belong to same family)
   */
  public shouldConsolidate(variants: RawProductData[]): boolean {
    if (variants.length <= 1) {
      return false;
    }

    // Check if all variants have same a_number
    const aNumbers = new Set(variants.map(v => this.extractANumber(v)).filter(Boolean));
    return aNumbers.size === 1;
  }

  /**
   * Validate product family group
   */
  public validateFamilyGroup(group: ProductFamilyGroup): boolean {
    if (!group.aNumber) {
      strapi.log.warn('[Grouping] Family group missing a_number');
      return false;
    }

    if (group.variants.length === 0) {
      strapi.log.warn(`[Grouping] Family ${group.aNumber} has no variants`);
      return false;
    }

    return true;
  }

  /**
   * Get group statistics
   */
  public getGroupStats(groups: ProductFamilyGroup[]) {
    const totalVariants = groups.reduce((sum, g) => sum + g.variants.length, 0);
    const avgVariantsPerFamily = totalVariants / groups.length;
    const maxVariants = Math.max(...groups.map(g => g.variants.length));
    const minVariants = Math.min(...groups.map(g => g.variants.length));

    return {
      totalFamilies: groups.length,
      totalVariants,
      avgVariantsPerFamily: avgVariantsPerFamily.toFixed(1),
      maxVariants,
      minVariants,
    };
  }
}

// Export singleton instance
export default new GroupingService();
