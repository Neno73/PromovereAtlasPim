/**
 * Image Deduplication Service
 * Prevents duplicate image uploads by checking existing media
 */

/**
 * Deduplication Check Result
 */
export interface DeduplicationResult {
  exists: boolean;
  mediaId?: number;
  url?: string;
  fileName: string;
}

/**
 * Image Deduplication Service Class
 */
class DeduplicationService {
  /**
   * Check if image already exists by filename
   */
  public async checkByFilename(fileName: string): Promise<DeduplicationResult> {
    try {
      const existingFile = await strapi.db.query('plugin::upload.file').findOne({
        where: { name: fileName },
        select: ['id', 'name', 'url'],
      });

      if (existingFile) {
        strapi.log.info(`[Deduplication] ✓ Image exists: ${fileName} (ID: ${existingFile.id})`);
        return {
          exists: true,
          mediaId: existingFile.id,
          url: existingFile.url,
          fileName,
        };
      }

      return {
        exists: false,
        fileName,
      };
    } catch (error) {
      strapi.log.error(`[Deduplication] Error checking file ${fileName}:`, error);
      return {
        exists: false,
        fileName,
      };
    }
  }

  /**
   * Check if image already exists by URL
   */
  public async checkByUrl(url: string): Promise<DeduplicationResult> {
    try {
      const existingFile = await strapi.db.query('plugin::upload.file').findOne({
        where: { url },
        select: ['id', 'name', 'url'],
      });

      if (existingFile) {
        strapi.log.info(`[Deduplication] ✓ Image exists by URL: ${url}`);
        return {
          exists: true,
          mediaId: existingFile.id,
          url: existingFile.url,
          fileName: existingFile.name,
        };
      }

      return {
        exists: false,
        fileName: '',
      };
    } catch (error) {
      strapi.log.error(`[Deduplication] Error checking URL ${url}:`, error);
      return {
        exists: false,
        fileName: '',
      };
    }
  }

  /**
   * Check if image already exists by hash
   */
  public async checkByHash(hash: string): Promise<DeduplicationResult> {
    try {
      const existingFile = await strapi.db.query('plugin::upload.file').findOne({
        where: { hash },
        select: ['id', 'name', 'url', 'hash'],
      });

      if (existingFile) {
        strapi.log.info(`[Deduplication] ✓ Image exists by hash: ${hash}`);
        return {
          exists: true,
          mediaId: existingFile.id,
          url: existingFile.url,
          fileName: existingFile.name,
        };
      }

      return {
        exists: false,
        fileName: '',
      };
    } catch (error) {
      strapi.log.error(`[Deduplication] Error checking hash ${hash}:`, error);
      return {
        exists: false,
        fileName: '',
      };
    }
  }

  /**
   * Batch check multiple filenames
   * More efficient than checking one by one
   */
  public async batchCheckByFilename(
    fileNames: string[]
  ): Promise<Map<string, DeduplicationResult>> {
    try {
      strapi.log.info(`[Deduplication] Batch checking ${fileNames.length} files...`);

      const existingFiles = await strapi.db.query('plugin::upload.file').findMany({
        where: {
          name: { $in: fileNames },
        },
        select: ['id', 'name', 'url'],
      });

      const resultMap = new Map<string, DeduplicationResult>();

      // Mark existing files
      for (const file of existingFiles) {
        resultMap.set(file.name, {
          exists: true,
          mediaId: file.id,
          url: file.url,
          fileName: file.name,
        });
      }

      // Mark non-existing files
      for (const fileName of fileNames) {
        if (!resultMap.has(fileName)) {
          resultMap.set(fileName, {
            exists: false,
            fileName,
          });
        }
      }

      const existingCount = existingFiles.length;
      const newCount = fileNames.length - existingCount;
      strapi.log.info(`[Deduplication] Found ${existingCount} existing, ${newCount} new files`);

      return resultMap;
    } catch (error) {
      strapi.log.error('[Deduplication] Batch check failed:', error);
      throw error;
    }
  }

  /**
   * Get media file by ID
   */
  public async getById(mediaId: number): Promise<any | null> {
    try {
      return await strapi.entityService.findOne('plugin::upload.file', mediaId);
    } catch (error) {
      strapi.log.error(`[Deduplication] Error fetching media ${mediaId}:`, error);
      return null;
    }
  }

  /**
   * Delete media file
   */
  public async delete(mediaId: number): Promise<boolean> {
    try {
      await strapi.plugins.upload.services.upload.remove({ id: mediaId });
      strapi.log.info(`[Deduplication] Deleted media ${mediaId}`);
      return true;
    } catch (error) {
      strapi.log.error(`[Deduplication] Error deleting media ${mediaId}:`, error);
      return false;
    }
  }

  /**
   * Find orphaned media files
   * (Files not referenced by any entity)
   */
  public async findOrphaned(limit: number = 100): Promise<any[]> {
    try {
      // This is a complex query that would need to check all relations
      // For now, return empty array - can be implemented later if needed
      strapi.log.info('[Deduplication] Orphan detection not yet implemented');
      return [];
    } catch (error) {
      strapi.log.error('[Deduplication] Error finding orphaned files:', error);
      return [];
    }
  }

  /**
   * Get media statistics
   */
  public async getStats(): Promise<{
    total: number;
    byMimeType: Record<string, number>;
    totalSize: number;
  }> {
    try {
      const allFiles = await strapi.db.query('plugin::upload.file').findMany({
        select: ['mime', 'size'],
      });

      const byMimeType: Record<string, number> = {};
      let totalSize = 0;

      for (const file of allFiles) {
        byMimeType[file.mime] = (byMimeType[file.mime] || 0) + 1;
        totalSize += file.size || 0;
      }

      return {
        total: allFiles.length,
        byMimeType,
        totalSize,
      };
    } catch (error) {
      strapi.log.error('[Deduplication] Error getting stats:', error);
      return {
        total: 0,
        byMimeType: {},
        totalSize: 0,
      };
    }
  }
}

// Export singleton instance
export default new DeduplicationService();
