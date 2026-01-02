/**
 * CloudFlare AutoRAG Service
 * R2 bucket integration for AutoRAG - uploads product JSON files to R2 buckets
 * AutoRAG automatically indexes files from R2 every 6 hours
 */

interface AutoRAGConfig {
  autorag_id: string;
  cloudflare_account_id: string;
  api_endpoint: string; // This is now the R2 bucket endpoint
  r2_bucket_name?: string; // R2 bucket name for this AutoRAG instance
}

interface AutoRAGProductData {
  sku: string;
  supplier_code: string;
  supplier_name: string;
  name: Record<string, string>;
  description: Record<string, string>;
  category_hierarchy: string;
  available_sizes?: string[];
  colors?: string[];
  material?: string;
  weight?: string;
  features?: string[];
  care_instructions?: string;
  main_image?: string;
  gallery_images?: string[];
  variant_type: 'single' | 'multi_size';
  industry_context?: string;
}

interface AutoRAGSearchResult {
  results: Array<{
    id: string;
    score: number;
    content: string;
    metadata?: Record<string, any>;
  }>;
}

class AutoRAGService {
  private readonly cloudflareApiToken: string;
  private readonly cloudflareAccountId: string;
  private readonly baseUrl: string;
  private readonly r2AccessKeyId: string;
  private readonly r2SecretAccessKey: string;
  private readonly r2Endpoint: string;

  constructor() {
    this.cloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN;
    this.cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID || 'a7c64d1d58510810b3c8f96d3631c8c9';
    this.baseUrl = process.env.AUTORAG_BASE_URL || 'https://api.cloudflare.com/client/v4';
    
    // R2 credentials for AutoRAG (malfini bucket)
    this.r2AccessKeyId = process.env.MALFINI_R2_ACCESS_KEY_ID;
    this.r2SecretAccessKey = process.env.MALFINI_R2_SECRET_ACCESS_KEY;
    this.r2Endpoint = process.env.R2_ENDPOINT || `https://${this.cloudflareAccountId}.r2.cloudflarestorage.com`;

    if (!this.cloudflareApiToken) {
      strapi.log.error('CLOUDFLARE_API_TOKEN environment variable is required');
      throw new Error('CloudFlare API token not configured');
    }
    
    if (!this.r2AccessKeyId || !this.r2SecretAccessKey) {
      strapi.log.error('R2 credentials (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) are required for AutoRAG');
      throw new Error('R2 credentials not configured');
    }
  }

  /**
   * Upload or update a single product in AutoRAG by storing in R2 bucket
   * AutoRAG will automatically index this file within 6 hours
   */
  async uploadProduct(config: AutoRAGConfig, productData: AutoRAGProductData): Promise<boolean> {
    try {
      const fileName = `${productData.supplier_code}_${productData.sku}.json`;
      const bucketName = config.r2_bucket_name || this.extractBucketFromConfig(config);
      
      if (!bucketName) {
        strapi.log.error('R2 bucket name not found in AutoRAG config');
        return false;
      }
      
      const uploadUrl = `${this.r2Endpoint}/${bucketName}/${fileName}`;
      const contentBody = JSON.stringify(productData, null, 2);

      // Use AWS SDK for proper R2 authentication
      const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
      
      const s3Client = new S3Client({
        region: 'auto',
        endpoint: this.r2Endpoint,
        credentials: {
          accessKeyId: this.r2AccessKeyId,
          secretAccessKey: this.r2SecretAccessKey,
        },
      });

      const uploadParams = {
        Bucket: bucketName,
        Key: fileName,
        Body: contentBody,
        ContentType: 'application/json',
      };

      await s3Client.send(new PutObjectCommand(uploadParams));
      
      // Return success since AWS SDK would throw on error
      strapi.log.debug(`✅ Uploaded product ${productData.sku} to R2 bucket ${bucketName} for AutoRAG ${config.autorag_id}`);
      return true;


    } catch (error) {
      strapi.log.error(`R2 upload error for ${productData.sku}:`, error);
      return false;
    }
  }

  /**
   * Update a product in AutoRAG (same as upload)
   */
  async updateProduct(config: AutoRAGConfig, productData: AutoRAGProductData): Promise<boolean> {
    return this.uploadProduct(config, productData);
  }

  /**
   * Delete a product from AutoRAG by removing from R2 bucket
   * AutoRAG will automatically remove from index within 6 hours
   */
  async deleteProduct(config: AutoRAGConfig, supplierCode: string, sku: string): Promise<boolean> {
    try {
      const fileName = `${supplierCode}_${sku}.json`;
      const bucketName = config.r2_bucket_name || this.extractBucketFromConfig(config);
      
      if (!bucketName) {
        strapi.log.error('R2 bucket name not found in AutoRAG config');
        return false;
      }
      
      const deleteUrl = `${this.r2Endpoint}/${bucketName}/${fileName}`;

      // Use AWS SDK for proper R2 authentication
      const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
      
      const s3Client = new S3Client({
        region: 'auto',
        endpoint: this.r2Endpoint,
        credentials: {
          accessKeyId: this.r2AccessKeyId,
          secretAccessKey: this.r2SecretAccessKey,
        },
      });

      const deleteParams = {
        Bucket: bucketName,
        Key: fileName,
      };

      await s3Client.send(new DeleteObjectCommand(deleteParams));
      
      // Return success since AWS SDK would throw on error
      strapi.log.debug(`🗑️ Deleted product ${sku} from R2 bucket ${bucketName} for AutoRAG ${config.autorag_id}`);
      return true;


    } catch (error) {
      strapi.log.error(`R2 delete error for ${sku}:`, error);
      return false;
    }
  }

  /**
   * Search products in AutoRAG
   */
  async searchProducts(ragId: string, query: string): Promise<AutoRAGSearchResult | null> {
    try {
      const searchUrl = `${this.baseUrl}/accounts/${this.cloudflareAccountId}/autorag/rags/${ragId}/ai-search`;

      const response = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.cloudflareApiToken}`,
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        const errorText = await response.text();
        strapi.log.error(`AutoRAG search failed: ${response.status} ${errorText}`);
        return null;
      }

      const result = await response.json();
      return result as AutoRAGSearchResult;

    } catch (error) {
      strapi.log.error('AutoRAG search error:', error);
      return null;
    }
  }

  /**
   * Bulk upload products to AutoRAG
   */
  async bulkUploadProducts(config: AutoRAGConfig, products: AutoRAGProductData[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process products in batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      const promises = batch.map(async (product) => {
        const result = await this.uploadProduct(config, product);
        if (result) {
          success++;
        } else {
          failed++;
          errors.push(`Failed to upload ${product.sku}`);
        }
      });

      await Promise.all(promises);
      
      // Small delay between batches
      if (i + batchSize < products.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return { success, failed, errors };
  }

  /**
   * Transform Strapi product to AutoRAG format
   */
  transformProductForAutoRAG(strapiProduct: any): AutoRAGProductData {
    const product: AutoRAGProductData = {
      sku: strapiProduct.sku,
      supplier_code: strapiProduct.supplier?.code || '',
      supplier_name: strapiProduct.supplier?.name || '',
      name: strapiProduct.name || {},
      description: strapiProduct.description || {},
      category_hierarchy: this.buildCategoryHierarchy(strapiProduct.categories),
      variant_type: strapiProduct.variant_type || 'single',
    };

    // Add optional fields if they exist
    if (strapiProduct.available_sizes?.length) {
      product.available_sizes = strapiProduct.available_sizes;
    }

    if (strapiProduct.colors?.length) {
      product.colors = strapiProduct.colors;
    }

    if (strapiProduct.material) {
      product.material = strapiProduct.material;
    }

    if (strapiProduct.weight) {
      product.weight = strapiProduct.weight;
    }

    if (strapiProduct.features?.length) {
      product.features = strapiProduct.features;
    }

    if (strapiProduct.care_instructions) {
      product.care_instructions = strapiProduct.care_instructions;
    }

    if (strapiProduct.main_image?.url) {
      product.main_image = strapiProduct.main_image.url;
    }

    if (strapiProduct.gallery_images?.length) {
      product.gallery_images = strapiProduct.gallery_images.map((img: any) => img.url).filter(Boolean);
    }

    // Build industry context for better AI understanding
    product.industry_context = this.buildIndustryContext(product);

    return product;
  }

  /**
   * Build category hierarchy string
   */
  private buildCategoryHierarchy(categories: any[]): string {
    if (!categories?.length) return '';
    
    // For now, just use the first category's name
    // TODO: Build proper hierarchy when category relationships are available
    const firstCategory = categories[0];
    if (firstCategory?.name?.en) {
      return firstCategory.name.en;
    }
    
    return '';
  }

  /**
   * Build industry context for AI understanding
   */
  private buildIndustryContext(product: AutoRAGProductData): string {
    const contexts = [];
    
    contexts.push('Perfect for promotional campaigns, corporate gifts, and marketing events.');
    
    if (product.category_hierarchy.toLowerCase().includes('clothing')) {
      contexts.push('Ideal for team building, company uniforms, and branded apparel.');
    }
    
    if (product.category_hierarchy.toLowerCase().includes('bags')) {
      contexts.push('Great for trade shows, conferences, and customer appreciation gifts.');
    }
    
    if (product.available_sizes?.length) {
      contexts.push(`Available in multiple sizes (${product.available_sizes.join(', ')}) to accommodate all recipients.`);
    }
    
    if (product.colors?.length) {
      contexts.push(`Multiple color options (${product.colors.join(', ')}) for brand coordination.`);
    }

    return contexts.join(' ');
  }

  /**
   * Health check for AutoRAG service
   */
  async healthCheck(ragId: string): Promise<boolean> {
    try {
      const result = await this.searchProducts(ragId, 'test');
      return result !== null;
    } catch {
      return false;
    }
  }

  /**
   * Extract bucket name from AutoRAG config api_endpoint
   * Handle both old AI Gateway URLs and new R2 bucket URLs
   */
  private extractBucketFromConfig(config: AutoRAGConfig): string | null {
    try {
      // If it's an R2 URL, extract bucket name
      if (config.api_endpoint.includes('.r2.cloudflarestorage.com/')) {
        const matches = config.api_endpoint.match(/\.r2\.cloudflarestorage\.com\/([^/]+)/);
        return matches ? matches[1] : null;
      }
      
      // For AutoRAG ID, use the AutoRAG ID as bucket name
      // This is common pattern: AutoRAG ID = bucket name
      if (config.autorag_id) {
        // Convert AutoRAG ID to valid bucket name if needed
        return config.autorag_id.replace(/[^a-z0-9-]/g, '-').toLowerCase();
      }
      
      return null;
    } catch (error) {
      strapi.log.error('Failed to extract bucket name from config:', error);
      return null;
    }
  }

  /**
   * Create simplified R2 authentication using direct credentials
   * R2 supports basic credential authentication
   */
  private getR2AuthHeaders(): Record<string, string> {
    return {
      'AWS-Access-Key-Id': this.r2AccessKeyId,
      'AWS-Secret-Access-Key': this.r2SecretAccessKey,
    };
  }

  /**
   * Simple SHA256 hash function
   */
  private async sha256(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// Create singleton instance
const autoragService = new AutoRAGService();

export default autoragService;
export { AutoRAGConfig, AutoRAGProductData, AutoRAGSearchResult };