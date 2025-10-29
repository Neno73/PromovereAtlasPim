/**
 * BullMQ Job Type Definitions
 * Defines the data structures for all queue jobs in the sync system
 */

/**
 * Supplier Sync Job
 * Orchestrates full sync for one supplier
 */
export interface SupplierSyncJobData {
  supplierId: number;
  supplierCode: string;
  triggerType: 'manual' | 'auto';
  triggeredBy?: string; // User ID or 'system'
}

export interface SupplierSyncJobResult {
  success: boolean;
  supplierId: number;
  supplierCode: string;
  statistics: {
    totalProductsFound: number;
    totalProductFamilies: number;
    familiesQueued: number;
    familiesSkipped: number;
    skippedPercentage: number;
  };
  duration: number; // milliseconds
  startedAt: string;
  completedAt: string;
}

/**
 * Product Family Job
 * Processes one product family (Product + all Variants)
 */
export interface ProductFamilyJobData {
  aNumber: string;
  supplierId: number;
  supplierCode: string;
  variantUrls: Array<{
    url: string;
    sku: string;
    hash: string;
  }>;
  productHash: string;
  supplierSyncJobId: string; // Parent job ID for progress tracking
}

export interface ProductFamilyJobResult {
  success: boolean;
  aNumber: string;
  productId?: number;
  variantIds: number[];
  isNew: boolean;
  variantsCreated: number;
  variantsUpdated: number;
  imagesQueued: number;
  errors?: string[];
}

/**
 * Image Upload Job
 * Uploads single image to R2 and creates Strapi media record
 */
export interface ImageUploadJobData {
  imageUrl: string;
  fileName: string;
  entityType: 'product' | 'product-variant';
  entityId: number;
  fieldName: 'main_image' | 'gallery_images' | 'primary_image' | 'model_image';
  productFamilyJobId?: string; // Optional: link back to parent job
}

export interface ImageUploadJobResult {
  success: boolean;
  mediaId?: number;
  url?: string;
  fileName: string;
  error?: string;
}

/**
 * Job Progress Data
 * Standardized progress reporting across all jobs
 */
export interface JobProgress {
  percentage: number; // 0-100
  message: string;
  details?: {
    current: number;
    total: number;
    phase?: string;
  };
}

/**
 * Queue Names
 * Centralized queue name constants
 */
export const QUEUE_NAMES = {
  SUPPLIER_SYNC: 'supplier-sync',
  PRODUCT_FAMILY: 'product-family',
  IMAGE_UPLOAD: 'image-upload',
} as const;

/**
 * Job Name Prefixes
 * Used for job ID generation and filtering
 */
export const JOB_PREFIXES = {
  SUPPLIER_SYNC: 'sup-sync',
  PRODUCT_FAMILY: 'prod-fam',
  IMAGE_UPLOAD: 'img-up',
} as const;
