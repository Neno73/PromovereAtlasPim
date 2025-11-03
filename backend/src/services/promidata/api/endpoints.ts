/**
 * Promidata API Endpoints Configuration
 * Centralizes all Promidata API URL construction
 */

/**
 * Base URL from environment or default
 */
export const getBaseUrl = (): string => {
  return process.env.PROMIDATA_BASE_URL || 'https://promi-dl.de/Profiles/Live/849c892e-b443-4f49-be3a-61a351cbdd23';
};

/**
 * Promidata API Endpoints
 */
export const endpoints = {
  /**
   * Import.txt - Contains all products with hashes
   * Format: url|hash per line
   */
  import: (): string => {
    return `${getBaseUrl()}/Import/Import.txt`;
  },

  /**
   * CAT.csv - Category hierarchy
   * Format: code;name;parent_code
   */
  categories: (): string => {
    return `${getBaseUrl()}/CAT.csv`;
  },

  /**
   * Product JSON endpoint for specific product
   * @param productUrl - Full URL to product JSON file
   */
  product: (productUrl: string): string => {
    return productUrl; // URLs are already complete in Import.txt
  },

  /**
   * Supplier-specific product list (legacy, if needed)
   * @param supplierCode - Supplier code (e.g., "A360")
   */
  supplierProducts: (supplierCode: string): string => {
    return `${getBaseUrl()}/${supplierCode}/${supplierCode}-100804.json`;
  },
};

/**
 * Get full URL for any endpoint
 */
export const getUrl = (endpoint: string): string => {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint; // Already a full URL
  }
  return `${getBaseUrl()}${endpoint}`;
};
