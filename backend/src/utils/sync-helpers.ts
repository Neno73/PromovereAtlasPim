/**
 * Sync Helpers - Eliminates repetitive patterns in sync operations
 * Standardized sync operations and data processing utilities
 */

import {
  productManager,
  categoryManager,
  supplierManager,
} from "./database-helpers";

/**
 * Standard API fetch with error handling
 */
export async function fetchFromApi(
  url: string,
  description: string
): Promise<any> {
  const fetch = require("node-fetch");

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${description}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    strapi.log.error(`Failed to fetch ${description} from ${url}:`, error);
    throw error;
  }
}

/**
 * Standard API text fetch with error handling
 */
export async function fetchTextFromApi(
  url: string,
  description: string
): Promise<string> {
  const fetch = require("node-fetch");

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${description}: ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    strapi.log.error(`Failed to fetch ${description} from ${url}:`, error);
    throw error;
  }
}

/**
 * Standard sync operation result structure
 */
export interface SyncResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{ item: string; error: string }>;
}

/**
 * Initialize sync result
 */
export function createSyncResult(): SyncResult {
  return {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  };
}

/**
 * Process sync items with standard error handling
 */
export async function processSyncItems<T>(
  items: T[],
  processor: (item: T) => Promise<{ created: boolean }>,
  itemIdentifier: (item: T) => string
): Promise<SyncResult> {
  const result = createSyncResult();

  for (const item of items) {
    try {
      const { created } = await processor(item);
      if (created) {
        result.imported++;
      } else {
        result.updated++;
      }
    } catch (error) {
      result.errors++;
      result.errorDetails.push({
        item: itemIdentifier(item),
        error: error.message,
      });
    }
  }

  return result;
}

/**
 * Standard multilingual field extraction
 */
export function extractMultilingualField(
  source: any,
  fieldPath: string[]
): any {
  const result: any = {};

  if (!source) return result;

  const languages = ["en", "de", "fr", "nl"];

  for (const lang of languages) {
    const langSource = source[lang];
    if (langSource) {
      let value = langSource;
      for (const pathSegment of fieldPath) {
        value = value?.[pathSegment];
      }
      if (value) {
        result[lang] = value;
      }
    }
  }

  return result;
}

/**
 * Standard image upload handler
 */
export async function uploadImageSafely(
  imageUrl: string,
  fileName: string,
  uploadFunction: (url: string, name: string) => Promise<number | null>
): Promise<number | null> {
  try {
    if (!imageUrl) return null;
    return await uploadFunction(imageUrl, fileName);
  } catch (error) {
    strapi.log.warn(`Image upload failed for ${fileName}:`, error.message);
    return null;
  }
}
