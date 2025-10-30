/**
 * Queue Manager Service
 * Provides queue management and monitoring functionality for the admin dashboard
 *
 * Responsibilities:
 * - Queue statistics and health monitoring
 * - Job listing and filtering
 * - Job retry and deletion
 * - Queue control (pause/resume/clean)
 */

import { Job, Queue } from 'bullmq';
import queueService from '../../../services/queue/queue-service';
import workerManager from '../../../services/queue/worker-manager';

/**
 * Pagination options for job listing
 */
interface PaginationOptions {
  page: number;
  pageSize: number;
  search?: string; // Optional search query
}

/**
 * Job state filter
 */
type JobState = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';

/**
 * Queue names
 */
type QueueName = 'supplier-sync' | 'product-family' | 'image-upload';

/**
 * Valid queue names for validation
 */
const VALID_QUEUE_NAMES: readonly QueueName[] = ['supplier-sync', 'product-family', 'image-upload'];

/**
 * Valid job states for validation
 */
const VALID_JOB_STATES: readonly JobState[] = ['waiting', 'active', 'completed', 'failed', 'delayed'];

/**
 * Validate queue name
 */
function validateQueueName(queueName: string): queueName is QueueName {
  return VALID_QUEUE_NAMES.includes(queueName as QueueName);
}

/**
 * Validate job state
 */
function validateJobState(state: string): state is JobState {
  return VALID_JOB_STATES.includes(state as JobState);
}

/**
 * Validate pagination options
 */
function validatePaginationOptions(page: number, pageSize: number): { isValid: boolean; error?: string } {
  if (!Number.isInteger(page) || page < 1) {
    return { isValid: false, error: 'Page must be a positive integer' };
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return { isValid: false, error: 'Page size must be between 1 and 100' };
  }
  return { isValid: true };
}

/**
 * Safely search job data without JSON.stringify
 * Searches specific fields to avoid security issues
 */
function matchesSearchQuery(job: Job, searchQuery: string): boolean {
  if (!searchQuery) return true;

  const query = searchQuery.toLowerCase();

  // Search job ID
  if (job.id && job.id.toString().toLowerCase().includes(query)) {
    return true;
  }

  // Search job name
  if (job.name && job.name.toLowerCase().includes(query)) {
    return true;
  }

  // Safely search specific job data fields (avoid exposing sensitive data)
  if (job.data) {
    const searchableFields = ['supplierCode', 'productFamily', 'sku', 'filename', 'url'];

    for (const field of searchableFields) {
      const value = job.data[field];
      if (value && String(value).toLowerCase().includes(query)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * In-memory cache for queue stats with race condition prevention and LRU eviction
 * Reduces Redis load by caching stats for 3 seconds
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

const statsCache = new Map<string, CacheEntry<any>>();
const pendingRequests = new Map<string, Promise<any>>();
const MAX_CACHE_SIZE = 100; // Maximum number of cached entries

/**
 * Evict oldest cache entry if cache is full (LRU)
 */
function evictOldestEntry() {
  if (statsCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = statsCache.keys().next().value;
    if (oldestKey) {
      statsCache.delete(oldestKey);
    }
  }
}

/**
 * Get cached data or execute function and cache result
 * Prevents race conditions by tracking pending requests
 */
function getCached<T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = 3000
): Promise<T> {
  const cached = statsCache.get(key);
  const now = Date.now();

  // Return cached data if still valid
  if (cached && now - cached.timestamp < cached.ttl) {
    return Promise.resolve(cached.data);
  }

  // Check if request is already pending
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }

  // Execute function and cache result
  const promise = fn()
    .then(data => {
      evictOldestEntry(); // Prevent unbounded memory growth
      statsCache.set(key, { data, timestamp: now, ttl });
      pendingRequests.delete(key);
      return data;
    })
    .catch(err => {
      pendingRequests.delete(key);
      throw err;
    });

  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Queue Manager Service
 * Note: Not using factories.createCoreService to avoid TypeScript issues with singleType
 */
export default () => ({

  /**
   * Get statistics for all queues or a specific queue
   * Cached for 3 seconds to reduce Redis load
   */
  async getQueueStats(queueName?: QueueName) {
    try {
      // Validate queue name if provided
      if (queueName && !validateQueueName(queueName)) {
        throw new Error(`Invalid queue name: ${queueName}. Must be one of: ${VALID_QUEUE_NAMES.join(', ')}`);
      }

      const cacheKey = queueName ? `stats:${queueName}` : 'stats:all';

      return await getCached(cacheKey, async () => {
        if (queueName) {
          return await queueService.getQueueStats(queueName);
        } else {
          return await queueService.getAllStats();
        }
      });
    } catch (error) {
      strapi.log.error('Failed to get queue stats:', error);
      throw error;
    }
  },

  /**
   * Get worker status and health information
   */
  async getWorkerStatus() {
    try {
      const health = workerManager.getHealth();

      return {
        isRunning: health.isRunning,
        workerCount: health.workerCount,
        workers: health.workers.map(w => ({
          name: w.name,
          isRunning: w.isRunning,
          isPaused: w.isPaused
        })),
        concurrency: {
          'supplier-sync': 1,
          'product-family': parseInt(process.env.BULLMQ_CONCURRENCY_FAMILIES || '3', 10),
          'image-upload': parseInt(process.env.BULLMQ_CONCURRENCY_IMAGES || '10', 10)
        }
      };
    } catch (error) {
      strapi.log.error('Failed to get worker status:', error);
      throw error;
    }
  },

  /**
   * List jobs from a queue with optional state filter, pagination, and search
   */
  async listJobs(
    queueName: QueueName,
    state: JobState = 'waiting',
    options: PaginationOptions = { page: 1, pageSize: 25 }
  ) {
    try {
      // Validate queue name
      if (!validateQueueName(queueName)) {
        throw new Error(`Invalid queue name: ${queueName}. Must be one of: ${VALID_QUEUE_NAMES.join(', ')}`);
      }

      // Validate job state
      if (!validateJobState(state)) {
        throw new Error(`Invalid job state: ${state}. Must be one of: ${VALID_JOB_STATES.join(', ')}`);
      }

      // Validate pagination options
      const { page, pageSize, search } = options;
      const validation = validatePaginationOptions(page, pageSize);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Get queue instance
      const queue = this.getQueueInstance(queueName);

      // If search is provided, fetch more jobs and filter
      // Otherwise, use pagination directly
      let jobs: Job[] = [];
      let total = 0;
      let filteredTotal = 0;

      if (search && search.trim()) {
        // Fetch a larger batch for search (max 500 jobs)
        const searchLimit = 500;

        switch (state) {
          case 'waiting':
            jobs = await queue.getWaiting(0, searchLimit - 1);
            total = await queue.getWaitingCount();
            break;
          case 'active':
            jobs = await queue.getActive(0, searchLimit - 1);
            total = await queue.getActiveCount();
            break;
          case 'completed':
            jobs = await queue.getCompleted(0, searchLimit - 1);
            total = await queue.getCompletedCount();
            break;
          case 'failed':
            jobs = await queue.getFailed(0, searchLimit - 1);
            total = await queue.getFailedCount();
            break;
          case 'delayed':
            jobs = await queue.getDelayed(0, searchLimit - 1);
            total = await queue.getDelayedCount();
            break;
          default:
            throw new Error(`Invalid job state: ${state}`);
        }

        // Filter jobs by search query
        jobs = jobs.filter(job => matchesSearchQuery(job, search.trim()));
        filteredTotal = jobs.length;

        // Apply pagination to filtered results
        const start = (page - 1) * pageSize;
        jobs = jobs.slice(start, start + pageSize);
      } else {
        // No search - use direct pagination
        const start = (page - 1) * pageSize;
        const end = start + pageSize - 1;

        switch (state) {
          case 'waiting':
            jobs = await queue.getWaiting(start, end);
            total = await queue.getWaitingCount();
            break;
          case 'active':
            jobs = await queue.getActive(start, end);
            total = await queue.getActiveCount();
            break;
          case 'completed':
            jobs = await queue.getCompleted(start, end);
            total = await queue.getCompletedCount();
            break;
          case 'failed':
            jobs = await queue.getFailed(start, end);
            total = await queue.getFailedCount();
            break;
          case 'delayed':
            jobs = await queue.getDelayed(start, end);
            total = await queue.getDelayedCount();
            break;
          default:
            throw new Error(`Invalid job state: ${state}`);
        }

        filteredTotal = total;
      }

      // Format jobs for response
      // Optimize: Batch get all job states instead of N individual calls
      const states = await Promise.all(jobs.map(job => job.getState()));
      const formattedJobs = jobs.map((job, index) => ({
        id: job.id,
        name: job.name,
        state: states[index],
        data: job.data,
        progress: job.progress,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn
      }));

      return {
        jobs: formattedJobs,
        total: filteredTotal,
        page,
        pageSize,
        totalPages: Math.ceil(filteredTotal / pageSize)
      };
    } catch (error) {
      strapi.log.error(`Failed to list ${state} jobs from ${queueName}:`, error);
      throw error;
    }
  },

  /**
   * Get detailed information about a specific job
   */
  async getJobDetails(queueName: QueueName, jobId: string) {
    try {
      // Validate queue name
      if (!validateQueueName(queueName)) {
        throw new Error(`Invalid queue name: ${queueName}. Must be one of: ${VALID_QUEUE_NAMES.join(', ')}`);
      }

      // Validate job ID
      if (!jobId || typeof jobId !== 'string' || jobId.trim() === '') {
        throw new Error('Invalid job ID: must be a non-empty string');
      }

      const job = await queueService.getJob(queueName, jobId);

      if (!job) {
        return {
          found: false,
          message: `Job ${jobId} not found in queue ${queueName}`
        };
      }

      const state = await job.getState();

      return {
        found: true,
        id: job.id,
        name: job.name,
        queueName,
        state,
        data: job.data,
        progress: job.progress,
        returnvalue: job.returnvalue,
        failedReason: job.failedReason,
        stacktrace: job.stacktrace,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        opts: {
          attempts: job.opts.attempts,
          delay: job.opts.delay
        }
      };
    } catch (error) {
      strapi.log.error(`Failed to get job details for ${jobId}:`, error);
      throw error;
    }
  },

  /**
   * Retry a failed job
   */
  async retryJob(queueName: QueueName, jobId: string) {
    try {
      const job = await queueService.getJob(queueName, jobId);

      if (!job) {
        throw new Error(`Job ${jobId} not found in queue ${queueName}`);
      }

      const state = await job.getState();

      if (state !== 'failed') {
        throw new Error(`Cannot retry job in state: ${state}. Only failed jobs can be retried.`);
      }

      // Retry the job
      await job.retry();

      strapi.log.info(`Retried job ${jobId} in queue ${queueName}`);

      return {
        success: true,
        jobId: job.id,
        message: 'Job queued for retry'
      };
    } catch (error) {
      strapi.log.error(`Failed to retry job ${jobId}:`, error);
      throw error;
    }
  },

  /**
   * Retry all failed jobs in a queue
   */
  async retryFailedJobs(queueName: QueueName, limit: number = 100) {
    try {
      const queue = this.getQueueInstance(queueName);
      const failedJobs = await queue.getFailed(0, limit - 1);

      let retriedCount = 0;
      let failedCount = 0;

      for (const job of failedJobs) {
        try {
          await job.retry();
          retriedCount++;
        } catch (error) {
          strapi.log.error(`Failed to retry job ${job.id}:`, error);
          failedCount++;
        }
      }

      strapi.log.info(`Retried ${retriedCount}/${failedJobs.length} failed jobs in ${queueName}`);

      return {
        success: true,
        retriedCount,
        failedCount,
        total: failedJobs.length,
        message: `Retried ${retriedCount} failed jobs`
      };
    } catch (error) {
      strapi.log.error(`Failed to retry failed jobs in ${queueName}:`, error);
      throw error;
    }
  },

  /**
   * Delete a job
   */
  async deleteJob(queueName: QueueName, jobId: string) {
    try {
      const job = await queueService.getJob(queueName, jobId);

      if (!job) {
        throw new Error(`Job ${jobId} not found in queue ${queueName}`);
      }

      await job.remove();

      strapi.log.info(`Deleted job ${jobId} from queue ${queueName}`);

      return {
        success: true,
        jobId: job.id,
        message: 'Job deleted successfully'
      };
    } catch (error) {
      strapi.log.error(`Failed to delete job ${jobId}:`, error);
      throw error;
    }
  },

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: QueueName) {
    try {
      // Validate queue name
      if (!validateQueueName(queueName)) {
        throw new Error(`Invalid queue name: ${queueName}. Must be one of: ${VALID_QUEUE_NAMES.join(', ')}`);
      }

      const queue = this.getQueueInstance(queueName);
      await queue.pause();

      strapi.log.info(`Paused queue: ${queueName}`);

      return {
        success: true,
        queueName,
        message: `Queue ${queueName} paused`
      };
    } catch (error) {
      strapi.log.error(`Failed to pause queue ${queueName}:`, error);
      throw error;
    }
  },

  /**
   * Resume a paused queue
   */
  async resumeQueue(queueName: QueueName) {
    try {
      // Validate queue name
      if (!validateQueueName(queueName)) {
        throw new Error(`Invalid queue name: ${queueName}. Must be one of: ${VALID_QUEUE_NAMES.join(', ')}`);
      }

      const queue = this.getQueueInstance(queueName);
      await queue.resume();

      strapi.log.info(`Resumed queue: ${queueName}`);

      return {
        success: true,
        queueName,
        message: `Queue ${queueName} resumed`
      };
    } catch (error) {
      strapi.log.error(`Failed to resume queue ${queueName}:`, error);
      throw error;
    }
  },

  /**
   * Clean old jobs from a queue
   */
  async cleanQueue(
    queueName: QueueName,
    grace: number = 3600000, // 1 hour default
    status: 'completed' | 'failed' = 'completed'
  ) {
    try {
      // Validate queue name
      if (!validateQueueName(queueName)) {
        throw new Error(`Invalid queue name: ${queueName}. Must be one of: ${VALID_QUEUE_NAMES.join(', ')}`);
      }

      // Validate grace period
      if (!Number.isInteger(grace) || grace < 0) {
        throw new Error('Grace period must be a non-negative integer');
      }

      // Validate status
      if (status !== 'completed' && status !== 'failed') {
        throw new Error('Status must be either "completed" or "failed"');
      }

      const queue = this.getQueueInstance(queueName);

      // Clean jobs older than grace period
      const deletedCount = await queue.clean(grace, 1000, status);

      strapi.log.info(`Cleaned ${deletedCount} ${status} jobs from ${queueName}`);

      return {
        success: true,
        queueName,
        deletedCount,
        status,
        grace,
        message: `Cleaned ${deletedCount} ${status} jobs older than ${grace / 1000}s`
      };
    } catch (error) {
      strapi.log.error(`Failed to clean queue ${queueName}:`, error);
      throw error;
    }
  },

  /**
   * Drain a queue (remove all jobs)
   */
  async drainQueue(queueName: QueueName) {
    try {
      const queue = this.getQueueInstance(queueName);
      await queue.drain();

      strapi.log.warn(`Drained all jobs from queue: ${queueName}`);

      return {
        success: true,
        queueName,
        message: `All jobs removed from ${queueName}`
      };
    } catch (error) {
      strapi.log.error(`Failed to drain queue ${queueName}:`, error);
      throw error;
    }
  },

  /**
   * Get queue instance (helper method)
   */
  getQueueInstance(queueName: QueueName): Queue {
    // Access private method via type assertion
    const queueServiceAny = queueService as any;
    return queueServiceAny.getQueue(queueName);
  }

});
