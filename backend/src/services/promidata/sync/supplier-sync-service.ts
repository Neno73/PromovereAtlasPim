/**
 * Supplier Sync Service
 * Discovers and syncs suppliers dynamically from Promidata
 */

import importParser from '../parsers/import-parser';

interface SupplierSyncResult {
  discovered: number;
  created: number;
  updated: number;
  failed: number;
  supplierCodes: string[];
}

class SupplierSyncService {
  /**
   * Discover suppliers from Promidata Import.txt and sync to database
   */
  async discoverAndSyncSuppliers(): Promise<SupplierSyncResult> {
    const result: SupplierSyncResult = {
      discovered: 0,
      created: 0,
      updated: 0,
      failed: 0,
      supplierCodes: [],
    };

    try {
      strapi.log.info('🔍 Discovering suppliers from Promidata...');

      // Parse Import.txt and extract unique supplier codes
      const entries = await importParser.parseImportFile();
      const supplierCodes = importParser.getSupplierCodes(entries);

      result.discovered = supplierCodes.length;
      result.supplierCodes = supplierCodes;

      strapi.log.info(`✅ Discovered ${supplierCodes.length} suppliers from Promidata`);

      // Sync each supplier to database
      for (const code of supplierCodes) {
        try {
          const supplierResult = await this.syncSupplier(code);
          if (supplierResult.created) {
            result.created++;
          } else if (supplierResult.updated) {
            result.updated++;
          }
        } catch (error) {
          strapi.log.error(`Failed to sync supplier ${code}:`, error);
          result.failed++;
        }
      }

      strapi.log.info(
        `📊 Supplier sync complete: ${result.created} created, ${result.updated} updated, ${result.failed} failed`
      );

      return result;
    } catch (error) {
      strapi.log.error('Supplier discovery failed:', error);
      throw error;
    }
  }

  /**
   * Sync individual supplier
   */
  private async syncSupplier(
    code: string
  ): Promise<{ created: boolean; updated: boolean }> {
    // Check if supplier exists
    const existing = await strapi.documents('api::supplier.supplier').findMany({
      filters: { code },
      limit: 1,
    });

    if (existing && existing.length > 0) {
      // Supplier exists - update last_sync_date
      await strapi.documents('api::supplier.supplier').update({
        documentId: existing[0].documentId,
        data: {
          last_sync_date: new Date(),
        },
      });

      return { created: false, updated: true };
    }

    // Create new supplier with minimal data
    // Admin can fill in additional details later
    await strapi.documents('api::supplier.supplier').create({
      data: {
        code,
        name: `Supplier ${code}`, // Placeholder name
        is_active: false, // Inactive by default - admin must activate
        auto_import: false,
        products_count: 0,
        last_sync_date: new Date(),
        last_sync_status: 'never' as const,
      },
    });

    strapi.log.info(`  ✅ Created supplier: ${code}`);
    return { created: true, updated: false };
  }

  /**
   * Get supplier codes that are in Promidata but not in database
   */
  async getMissingSuppliers(): Promise<string[]> {
    try {
      // Get supplier codes from Promidata
      const entries = await importParser.parseImportFile();
      const promidataSuppliers = new Set(importParser.getSupplierCodes(entries));

      // Get supplier codes from database
      const dbSuppliers = await strapi.documents('api::supplier.supplier').findMany({
        fields: ['code'],
        pagination: { page: 1, pageSize: 200 },
      });

      const dbSupplierCodes = new Set(dbSuppliers.map((s: any) => s.code));

      // Find missing suppliers
      const missing = Array.from(promidataSuppliers).filter(
        (code) => !dbSupplierCodes.has(code)
      );

      return missing.sort();
    } catch (error) {
      strapi.log.error('Failed to get missing suppliers:', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new SupplierSyncService();
