/**
 * Category Parser
 * Parses Promidata's CAT.csv file
 */

import promidataClient from '../api/promidata-client';
import { endpoints } from '../api/endpoints';

/**
 * Parsed Category Data
 */
export interface CategoryData {
  code: string;
  name: string;
  parentCode: string | null;
}

/**
 * Category Tree Node
 */
export interface CategoryNode extends CategoryData {
  children: CategoryNode[];
  level: number;
}

/**
 * Category Parser Class
 */
class CategoryParser {
  /**
   * Fetch and parse CAT.csv
   * Format: code;name;parent_code
   */
  public async parseCategories(): Promise<CategoryData[]> {
    try {
      const categoriesUrl = endpoints.categories();
      const text = await promidataClient.fetchText(categoriesUrl);

      const categories: CategoryData[] = [];
      const lines = text.split('\n').filter(line => line.trim());

      // Skip header line (first line)
      for (let i = 1; i < lines.length; i++) {
        const category = this.parseLine(lines[i]);
        if (category) {
          categories.push(category);
        }
      }

      console.log(`[CategoryParser] Parsed ${categories.length} categories`);
      return categories;
    } catch (error) {
      console.error('[CategoryParser] Failed to parse categories:', error);
      throw error;
    }
  }

  /**
   * Parse a single CSV line
   * Format: code;name;parent_code
   */
  private parseLine(line: string): CategoryData | null {
    const parts = line.split(';');

    if (parts.length < 2) {
      return null;
    }

    const code = parts[0]?.trim();
    const name = parts[1]?.trim();
    const parentCode = parts[2]?.trim() || null;

    if (!code || !name) {
      return null;
    }

    return {
      code,
      name,
      parentCode,
    };
  }

  /**
   * Build category tree from flat list
   */
  public buildTree(categories: CategoryData[]): CategoryNode[] {
    const categoryMap = new Map<string, CategoryNode>();
    const rootCategories: CategoryNode[] = [];

    // Create nodes
    for (const category of categories) {
      categoryMap.set(category.code, {
        ...category,
        children: [],
        level: 0,
      });
    }

    // Build tree
    for (const category of categories) {
      const node = categoryMap.get(category.code)!;

      if (category.parentCode && categoryMap.has(category.parentCode)) {
        // Add to parent
        const parent = categoryMap.get(category.parentCode)!;
        parent.children.push(node);
        node.level = parent.level + 1;
      } else {
        // Root category
        rootCategories.push(node);
      }
    }

    return rootCategories;
  }

  /**
   * Find category by code
   */
  public findByCode(categories: CategoryData[], code: string): CategoryData | null {
    return categories.find(cat => cat.code === code) || null;
  }

  /**
   * Get category path (breadcrumb trail)
   * Returns array from root to target category
   */
  public getCategoryPath(
    categories: CategoryData[],
    targetCode: string
  ): CategoryData[] {
    const path: CategoryData[] = [];
    let current = this.findByCode(categories, targetCode);

    while (current) {
      path.unshift(current); // Add to beginning
      if (current.parentCode) {
        current = this.findByCode(categories, current.parentCode);
      } else {
        current = null;
      }
    }

    return path;
  }

  /**
   * Get all subcategories (recursive)
   */
  public getSubcategories(
    categories: CategoryData[],
    parentCode: string
  ): CategoryData[] {
    const subcategories: CategoryData[] = [];

    const directChildren = categories.filter(cat => cat.parentCode === parentCode);

    for (const child of directChildren) {
      subcategories.push(child);
      // Recursively get children's children
      const grandchildren = this.getSubcategories(categories, child.code);
      subcategories.push(...grandchildren);
    }

    return subcategories;
  }

  /**
   * Get root categories (no parent)
   */
  public getRootCategories(categories: CategoryData[]): CategoryData[] {
    return categories.filter(cat => !cat.parentCode);
  }

  /**
   * Convert category data to Strapi format
   */
  public toStrapiFormat(category: CategoryData) {
    return {
      code: category.code,
      name: category.name,
      parent_code: category.parentCode,
      // Additional Strapi fields can be added here
    };
  }

  /**
   * Batch convert to Strapi format
   */
  public toStrapiFormatBatch(categories: CategoryData[]) {
    return categories.map(cat => this.toStrapiFormat(cat));
  }
}

// Export singleton instance
export default new CategoryParser();
