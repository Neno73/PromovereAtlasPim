/**
 * Import.txt Parser
 * Parses Promidata's Import.txt file which contains product URLs and hashes
 */

import promidataClient from '../api/promidata-client';
import { endpoints } from '../api/endpoints';

/**
 * Parsed Import Entry
 */
export interface ImportEntry {
  url: string;
  hash: string;
  sku: string; // Extracted from URL
  supplierCode: string; // Extracted from URL
}

/**
 * Import Parser Class
 */
class ImportParser {
  /**
   * Parse Import.txt and return all entries
   */
  public async parseImportFile(): Promise<ImportEntry[]> {
    try {
      const importUrl = endpoints.import();
      const text = await promidataClient.fetchText(importUrl);

      const entries: ImportEntry[] = [];
      const lines = text.split('\n').filter(line => line.trim());

      for (const line of lines) {
        // Skip CAT.csv line
        if (line.includes('CAT.csv')) {
          continue;
        }

        // Parse product entry: url|hash
        if (line.includes('|')) {
          const [fullUrlPart, hash] = line.split('|');
          if (fullUrlPart && hash) {
            const cleanUrl = fullUrlPart.trim();
            const supplierCode = this.extractSupplierCodeFromUrl(cleanUrl);
            const sku = this.extractSkuFromUrl(cleanUrl);

            entries.push({
              url: cleanUrl,
              hash: hash.trim(),
              sku,
              supplierCode,
            });
          }
        }
      }

      strapi.log.info(`[ImportParser] Parsed ${entries.length} product entries from Import.txt`);
      return entries;
    } catch (error) {
      strapi.log.error('[ImportParser] Failed to parse Import.txt:', error);
      throw error;
    }
  }

  /**
   * Parse Import.txt for a specific supplier
   */
  public async parseForSupplier(supplierCode: string): Promise<ImportEntry[]> {
    const allEntries = await this.parseImportFile();
    const supplierEntries = allEntries.filter(entry => entry.supplierCode === supplierCode);

    strapi.log.info(`[ImportParser] Found ${supplierEntries.length} entries for supplier ${supplierCode}`);
    return supplierEntries;
  }

  /**
   * Extract supplier code from URL
   * Example: https://.../A23/A23-100804.json → A23
   */
  private extractSupplierCodeFromUrl(url: string): string {
    const match = url.match(/\/([A-Z]\d+)\//);
    return match ? match[1] : '';
  }

  /**
   * Extract SKU from URL filename
   * Example: https://.../A23/A23-100804.json → A23-100804
   */
  private extractSkuFromUrl(url: string): string {
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace('.json', '');
  }

  /**
   * Group entries by supplier code
   */
  public groupBySupplier(entries: ImportEntry[]): Map<string, ImportEntry[]> {
    const grouped = new Map<string, ImportEntry[]>();

    for (const entry of entries) {
      if (!grouped.has(entry.supplierCode)) {
        grouped.set(entry.supplierCode, []);
      }
      grouped.get(entry.supplierCode)!.push(entry);
    }

    return grouped;
  }

  /**
   * Get unique supplier codes from entries
   */
  public getSupplierCodes(entries: ImportEntry[]): string[] {
    const codes = new Set(entries.map(entry => entry.supplierCode));
    return Array.from(codes).sort();
  }
}

// Export singleton instance
export default new ImportParser();
