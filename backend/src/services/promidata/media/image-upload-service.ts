/**
 * Image Upload Service
 * Handles downloading images and uploading to R2 + creating Strapi media records
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import promidataClient from '../api/promidata-client';
import deduplicationService from './deduplication';

/**
 * Upload Result
 */
export interface UploadResult {
  success: boolean;
  mediaId?: number;
  url?: string;
  fileName: string;
  error?: string;
  wasDedup: boolean; // Was this a deduplicated image?
}

/**
 * Image Upload Service Class
 */
class ImageUploadService {
  private r2Client: S3Client | null = null;

  /**
   * Validate required R2 environment variables
   */
  private validateR2EnvVars(): void {
    const required = [
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET_NAME',
      'R2_PUBLIC_URL',
      'R2_ENDPOINT'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required R2 environment variables: ${missing.join(', ')}. ` +
        `Please check your .env file.`
      );
    }
  }

  /**
   * Initialize R2 client (lazy loading)
   */
  private getR2Client(): S3Client {
    if (!this.r2Client) {
      // Validate environment variables before creating client
      this.validateR2EnvVars();

      this.r2Client = new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
      });
    }

    return this.r2Client;
  }

  /**
   * Upload image from URL
   * Main entry point for image uploads
   *
   * Deduplication priority:
   * 1. Check by source URL (Promidata URL) - prevents re-uploading same image
   * 2. Check by filename - fallback for backwards compatibility
   */
  public async uploadFromUrl(
    imageUrl: string,
    fileName: string
  ): Promise<UploadResult> {
    try {
      strapi.log.info(`[ImageUpload] Processing: ${fileName}`);

      // Extract extension from URL
      const extension = this.extractExtension(imageUrl);
      const cleanFileName = `${fileName}.${extension}`;

      // PRIORITY 1: Check by source URL (Promidata URL)
      // This is the most important check - prevents uploading same image twice
      // even when used for different variants
      const sourceUrlCheck = await deduplicationService.checkBySourceUrl(imageUrl);
      if (sourceUrlCheck.exists) {
        strapi.log.info(`[ImageUpload] ↻ Deduplicated by source URL: ${imageUrl}`);
        return {
          success: true,
          mediaId: sourceUrlCheck.mediaId,
          url: sourceUrlCheck.url,
          fileName: sourceUrlCheck.fileName,
          wasDedup: true,
        };
      }

      // PRIORITY 2: Check by filename (backwards compatibility)
      const filenameCheck = await deduplicationService.checkByFilename(cleanFileName);
      if (filenameCheck.exists) {
        strapi.log.info(`[ImageUpload] ↻ Deduplicated by filename: ${cleanFileName}`);
        return {
          success: true,
          mediaId: filenameCheck.mediaId,
          url: filenameCheck.url,
          fileName: cleanFileName,
          wasDedup: true,
        };
      }

      // Download image
      const imageBuffer = await promidataClient.fetchBuffer(imageUrl);
      const contentType = this.detectContentType(imageUrl, imageBuffer);

      // Upload to R2
      await this.uploadToR2(cleanFileName, imageBuffer, contentType);

      // Create Strapi media record (with source URL for future deduplication)
      const mediaId = await this.createMediaRecord(cleanFileName, imageBuffer, contentType, extension, imageUrl);

      const publicUrl = `${process.env.R2_PUBLIC_URL}/${cleanFileName}`;

      strapi.log.info(`[ImageUpload] ✓ Uploaded: ${cleanFileName} (ID: ${mediaId})`);

      return {
        success: true,
        mediaId,
        url: publicUrl,
        fileName: cleanFileName,
        wasDedup: false,
      };
    } catch (error) {
      strapi.log.error(`[ImageUpload] ✗ Failed to upload ${fileName}:`, error.message);
      return {
        success: false,
        fileName,
        error: error.message,
        wasDedup: false,
      };
    }
  }

  /**
   * Extract file extension from URL
   */
  private extractExtension(url: string): string {
    if (url.includes('.png')) return 'png';
    if (url.includes('.gif')) return 'gif';
    if (url.includes('.webp')) return 'webp';
    if (url.includes('.svg')) return 'svg';
    return 'jpg'; // Default to jpg
  }

  /**
   * Detect content type from URL or buffer
   */
  private detectContentType(url: string, buffer: Buffer): string {
    // Check magic numbers (file signatures)
    if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
    if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'image/gif';
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'image/jpeg';

    // Fallback to URL-based detection
    if (url.includes('.png')) return 'image/png';
    if (url.includes('.gif')) return 'image/gif';
    if (url.includes('.webp')) return 'image/webp';
    if (url.includes('.svg')) return 'image/svg+xml';

    return 'image/jpeg'; // Default
  }

  /**
   * Upload image buffer to Cloudflare R2
   */
  private async uploadToR2(
    fileName: string,
    buffer: Buffer,
    contentType: string
  ): Promise<void> {
    try {
      const r2 = this.getR2Client();

      const uploadParams = {
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: fileName,
        Body: buffer,
        ContentType: contentType,
      };

      await r2.send(new PutObjectCommand(uploadParams));

      strapi.log.info(`[ImageUpload] ✓ Uploaded to R2: ${fileName}`);
    } catch (error) {
      strapi.log.error(`[ImageUpload] ✗ R2 upload failed for ${fileName}:`, error);
      throw new Error(`R2 upload failed: ${error.message}`);
    }
  }

  /**
   * Create Strapi media record
   * @param sourceUrl - Original Promidata URL for deduplication tracking
   */
  private async createMediaRecord(
    fileName: string,
    buffer: Buffer,
    contentType: string,
    extension: string,
    sourceUrl?: string
  ): Promise<number> {
    try {
      const fileData = {
        name: fileName,
        hash: crypto.createHash('md5').update(fileName).digest('hex'),
        ext: `.${extension}`,
        mime: contentType,
        size: buffer.length / 1024, // KB
        url: `${process.env.R2_PUBLIC_URL}/${fileName}`,
        provider: 'aws-s3',
        provider_metadata: {
          public_id: fileName,
          resource_type: 'image',
          source_url: sourceUrl, // Store original Promidata URL for deduplication
        },
        folderPath: '/',
      };

      const uploadedFile = await strapi.entityService.create('plugin::upload.file', {
        data: fileData,
      });

      return Number(uploadedFile.id);
    } catch (error) {
      strapi.log.error(`[ImageUpload] ✗ Failed to create media record for ${fileName}:`, error);
      throw new Error(`Media record creation failed: ${error.message}`);
    }
  }

  /**
   * Batch upload images
   * Uploads multiple images with limited concurrency
   */
  public async batchUpload(
    images: Array<{ url: string; fileName: string }>,
    concurrency: number = 5
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    // Process in batches
    for (let i = 0; i < images.length; i += concurrency) {
      const batch = images.slice(i, i + concurrency);

      const batchResults = await Promise.all(
        batch.map(img => this.uploadFromUrl(img.url, img.fileName))
      );

      results.push(...batchResults);
    }

    const successCount = results.filter(r => r.success).length;
    const dedupCount = results.filter(r => r.wasDedup).length;

    strapi.log.info(`[ImageUpload] Batch complete: ${successCount}/${images.length} successful (${dedupCount} deduplicated)`);

    return results;
  }

  /**
   * Generate unique filename for image
   * Based on entity type, ID, and field name
   */
  public generateFileName(
    entityType: 'product' | 'product-variant',
    entityId: number | string,
    fieldName: string,
    index: number = 0
  ): string {
    const timestamp = Date.now();
    const suffix = index > 0 ? `-${index}` : '';
    return `${entityType}-${entityId}-${fieldName}${suffix}-${timestamp}`;
  }

  /**
   * Delete image from R2 and Strapi
   */
  public async delete(mediaId: number): Promise<boolean> {
    try {
      // Get media file info
      const mediaFile = await deduplicationService.getById(mediaId);

      if (!mediaFile) {
        strapi.log.warn(`[ImageUpload] Media ${mediaId} not found`);
        return false;
      }

      // Delete from Strapi (this should also trigger R2 deletion via plugin)
      await deduplicationService.delete(mediaId);

      strapi.log.info(`[ImageUpload] ✓ Deleted media ${mediaId}`);
      return true;
    } catch (error) {
      strapi.log.error(`[ImageUpload] ✗ Failed to delete media ${mediaId}:`, error);
      return false;
    }
  }

  /**
   * Get upload statistics
   */
  public async getStats(): Promise<{
    totalImages: number;
    totalSize: number;
    byType: Record<string, number>;
  }> {
    const stats = await deduplicationService.getStats();
    return {
      totalImages: stats.total,
      totalSize: stats.totalSize,
      byType: stats.byMimeType,
    };
  }
}

// Export singleton instance
export default new ImageUploadService();
