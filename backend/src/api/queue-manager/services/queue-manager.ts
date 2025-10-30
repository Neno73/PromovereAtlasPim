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
 * Queue Manager Service
 * Note: Not using factories.createCoreService to avoid TypeScript issues with singleType
 */
export default () => ({

  /**
   * Get statistics for all queues or a specific queue
   */
  async getQueueStats(queueName?: QueueName) {
    try {
      if (queueName) {
        return await queueService.getQueueStats(queueName);
      } else {
        return await queueService.getAllStats();
      }
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
   * List jobs from a queue with optional state filter and pagination
   */
  async listJobs(
    queueName: QueueName,
    state: JobState = 'waiting',
    options: PaginationOptions = { page: 1, pageSize: 25 }
  ) {
    try {
      const { page, pageSize } = options;
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      // Get queue instance
      const queue = this.getQueueInstance(queueName);

      // Get jobs by state
      let jobs: Job[] = [];
      let total = 0;

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

      // Format jobs for response
      const formattedJobs = await Promise.all(
        jobs.map(async (job) => this.formatJobForList(job))
      );

      return {
        jobs: formattedJobs,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
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
  },

  /**
   * Format job for list response (helper method)
   */
  async formatJobForList(job: Job) {
    const state = await job.getState();

    return {
      id: job.id,
      name: job.name,
      state,
      data: job.data,
      progress: job.progress,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn
    };
  }

});
