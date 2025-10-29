/**
 * BullMQ Queue Configuration
 * Defines concurrency, retry strategies, and timeouts for all queues
 */

import { QueueOptions, WorkerOptions } from 'bullmq';

/**
 * Get environment variables with fallback defaults
 */
const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
};

/**
 * Redis Connection Configuration
 * Shared across all queues and workers
 */
export const redisConnection = {
  url: process.env.REDIS_URL,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  // TLS is handled automatically by rediss:// protocol
};

/**
 * Default Queue Options
 * Applied to all queues unless overridden
 */
export const defaultQueueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 3600, // Keep for 24 hours
    },
    removeOnFail: {
      count: 500, // Keep last 500 failed jobs for debugging
      age: 7 * 24 * 3600, // Keep for 7 days
    },
  },
};

/**
 * Supplier Sync Worker Configuration
 * Process suppliers sequentially (concurrency: 1)
 */
export const supplierSyncWorkerOptions: WorkerOptions = {
  connection: redisConnection,
  concurrency: 1, // One supplier at a time to avoid rate limiting
  limiter: {
    max: 1, // Max 1 job per...
    duration: 1000, // ...1 second
  },
  settings: {
    backoffStrategy: (attemptsMade: number) => {
      // Exponential backoff: 2^attempt * 30 seconds
      return Math.pow(2, attemptsMade) * 30000;
    },
  },
};

/**
 * Supplier Sync Job Options
 */
export const supplierSyncJobOptions = {
  attempts: 2, // Retry once on failure
  backoff: {
    type: 'exponential' as const,
    delay: 30000, // 30 seconds
  },
  timeout: getEnvNumber('BULLMQ_JOB_TIMEOUT_SUPPLIER', 1800000), // 30 minutes default
};

/**
 * Product Family Worker Configuration
 * Process multiple families concurrently
 */
export const productFamilyWorkerOptions: WorkerOptions = {
  connection: redisConnection,
  concurrency: getEnvNumber('BULLMQ_CONCURRENCY_FAMILIES', 3), // 3 families at once
  limiter: {
    max: 5, // Max 5 jobs per...
    duration: 1000, // ...1 second (rate limiting)
  },
  settings: {
    backoffStrategy: (attemptsMade: number) => {
      // Exponential backoff: 2^attempt * 10 seconds
      return Math.pow(2, attemptsMade) * 10000;
    },
  },
};

/**
 * Product Family Job Options
 */
export const productFamilyJobOptions = {
  attempts: 3, // Retry up to 3 times
  backoff: {
    type: 'exponential' as const,
    delay: 10000, // 10 seconds
  },
  timeout: getEnvNumber('BULLMQ_JOB_TIMEOUT_FAMILY', 300000), // 5 minutes default
};

/**
 * Image Upload Worker Configuration
 * High concurrency for parallel uploads
 */
export const imageUploadWorkerOptions: WorkerOptions = {
  connection: redisConnection,
  concurrency: getEnvNumber('BULLMQ_CONCURRENCY_IMAGES', 10), // 10 images at once
  limiter: {
    max: 20, // Max 20 jobs per...
    duration: 1000, // ...1 second
  },
  settings: {
    backoffStrategy: () => {
      // Fixed 30 second delay for image retries
      return 30000;
    },
  },
};

/**
 * Image Upload Job Options
 */
export const imageUploadJobOptions = {
  attempts: 5, // Retry up to 5 times (images can be flaky)
  backoff: {
    type: 'fixed' as const,
    delay: 30000, // 30 seconds fixed delay
  },
  timeout: getEnvNumber('BULLMQ_JOB_TIMEOUT_IMAGE', 120000), // 2 minutes default
};

/**
 * Job ID Generator
 * Creates unique, sortable job IDs
 */
export const generateJobId = (prefix: string, ...parts: (string | number)[]): string => {
  const timestamp = Date.now();
  const partsStr = parts.join('-');
  return `${prefix}-${timestamp}-${partsStr}`;
};
