/**
 * Queue Manager Controller
 * Handles HTTP requests for queue management operations
 */

export default ({

  /**
   * GET /api/queue-manager/stats
   * GET /api/queue-manager/stats/:queue
   * Get queue statistics
   */
  async getStats(ctx) {
    try {
      const { queue } = ctx.params;
      const queueName = queue as 'supplier-sync' | 'product-family' | 'image-upload' | undefined;

      // Validate queue name if provided
      if (queueName && !['supplier-sync', 'product-family', 'image-upload'].includes(queueName)) {
        return ctx.badRequest('Invalid queue name');
      }

      const stats = await strapi
        .service('api::queue-manager.queue-manager')
        .getQueueStats(queueName);

      ctx.body = stats;
    } catch (error) {
      strapi.log.error('Get stats error:', error);
      ctx.internalServerError('Failed to get queue statistics');
    }
  },

  /**
   * GET /api/queue-manager/workers
   * Get worker status
   */
  async getWorkers(ctx) {
    try {
      const workerStatus = await strapi
        .service('api::queue-manager.queue-manager')
        .getWorkerStatus();

      ctx.body = workerStatus;
    } catch (error) {
      strapi.log.error('Get workers error:', error);
      ctx.internalServerError('Failed to get worker status');
    }
  },

  /**
   * GET /api/queue-manager/:queue/jobs?state=waiting&page=1&pageSize=25
   * List jobs from a queue
   */
  async listJobs(ctx) {
    try {
      const { queue } = ctx.params;
      const { state = 'waiting', page = '1', pageSize = '25' } = ctx.query;

      // Validate queue name
      if (!['supplier-sync', 'product-family', 'image-upload'].includes(queue)) {
        return ctx.badRequest('Invalid queue name');
      }

      // Validate state
      if (!['waiting', 'active', 'completed', 'failed', 'delayed'].includes(state as string)) {
        return ctx.badRequest('Invalid job state');
      }

      // Parse pagination
      const pageNum = parseInt(page as string, 10);
      const pageSizeNum = parseInt(pageSize as string, 10);

      if (isNaN(pageNum) || pageNum < 1) {
        return ctx.badRequest('Invalid page number');
      }

      if (isNaN(pageSizeNum) || pageSizeNum < 1 || pageSizeNum > 100) {
        return ctx.badRequest('Invalid page size (1-100)');
      }

      const result = await strapi
        .service('api::queue-manager.queue-manager')
        .listJobs(queue, state as any, { page: pageNum, pageSize: pageSizeNum });

      ctx.body = result;
    } catch (error) {
      strapi.log.error('List jobs error:', error);
      ctx.internalServerError('Failed to list jobs');
    }
  },

  /**
   * GET /api/queue-manager/:queue/jobs/:jobId
   * Get job details
   */
  async getJob(ctx) {
    try {
      const { queue, jobId } = ctx.params;

      // Validate queue name
      if (!['supplier-sync', 'product-family', 'image-upload'].includes(queue)) {
        return ctx.badRequest('Invalid queue name');
      }

      if (!jobId) {
        return ctx.badRequest('Job ID is required');
      }

      const result = await strapi
        .service('api::queue-manager.queue-manager')
        .getJobDetails(queue, jobId);

      ctx.body = result;
    } catch (error) {
      strapi.log.error('Get job error:', error);
      ctx.internalServerError('Failed to get job details');
    }
  },

  /**
   * POST /api/queue-manager/:queue/jobs/:jobId/retry
   * Retry a failed job
   */
  async retryJob(ctx) {
    try {
      const { queue, jobId } = ctx.params;

      // Validate queue name
      if (!['supplier-sync', 'product-family', 'image-upload'].includes(queue)) {
        return ctx.badRequest('Invalid queue name');
      }

      if (!jobId) {
        return ctx.badRequest('Job ID is required');
      }

      const result = await strapi
        .service('api::queue-manager.queue-manager')
        .retryJob(queue, jobId);

      ctx.body = result;
    } catch (error) {
      strapi.log.error('Retry job error:', error);
      ctx.badRequest(error.message || 'Failed to retry job');
    }
  },

  /**
   * POST /api/queue-manager/:queue/retry-failed
   * Retry all failed jobs in a queue
   */
  async retryFailedJobs(ctx) {
    try {
      const { queue } = ctx.params;
      const { limit = '100' } = ctx.request.body as any;

      // Validate queue name
      if (!['supplier-sync', 'product-family', 'image-upload'].includes(queue)) {
        return ctx.badRequest('Invalid queue name');
      }

      const limitNum = parseInt(limit, 10);

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
        return ctx.badRequest('Invalid limit (1-1000)');
      }

      const result = await strapi
        .service('api::queue-manager.queue-manager')
        .retryFailedJobs(queue, limitNum);

      ctx.body = result;
    } catch (error) {
      strapi.log.error('Retry failed jobs error:', error);
      ctx.internalServerError('Failed to retry failed jobs');
    }
  },

  /**
   * DELETE /api/queue-manager/:queue/jobs/:jobId
   * Delete a job
   */
  async deleteJob(ctx) {
    try {
      const { queue, jobId } = ctx.params;

      // Validate queue name
      if (!['supplier-sync', 'product-family', 'image-upload'].includes(queue)) {
        return ctx.badRequest('Invalid queue name');
      }

      if (!jobId) {
        return ctx.badRequest('Job ID is required');
      }

      const result = await strapi
        .service('api::queue-manager.queue-manager')
        .deleteJob(queue, jobId);

      ctx.body = result;
    } catch (error) {
      strapi.log.error('Delete job error:', error);
      ctx.badRequest(error.message || 'Failed to delete job');
    }
  },

  /**
   * POST /api/queue-manager/:queue/pause
   * Pause a queue
   */
  async pauseQueue(ctx) {
    try {
      const { queue } = ctx.params;

      // Validate queue name
      if (!['supplier-sync', 'product-family', 'image-upload'].includes(queue)) {
        return ctx.badRequest('Invalid queue name');
      }

      const result = await strapi
        .service('api::queue-manager.queue-manager')
        .pauseQueue(queue);

      ctx.body = result;
    } catch (error) {
      strapi.log.error('Pause queue error:', error);
      ctx.internalServerError('Failed to pause queue');
    }
  },

  /**
   * POST /api/queue-manager/:queue/resume
   * Resume a paused queue
   */
  async resumeQueue(ctx) {
    try {
      const { queue } = ctx.params;

      // Validate queue name
      if (!['supplier-sync', 'product-family', 'image-upload'].includes(queue)) {
        return ctx.badRequest('Invalid queue name');
      }

      const result = await strapi
        .service('api::queue-manager.queue-manager')
        .resumeQueue(queue);

      ctx.body = result;
    } catch (error) {
      strapi.log.error('Resume queue error:', error);
      ctx.internalServerError('Failed to resume queue');
    }
  },

  /**
   * POST /api/queue-manager/:queue/clean
   * Clean old jobs from a queue
   */
  async cleanQueue(ctx) {
    try {
      const { queue } = ctx.params;
      const { grace = 3600000, status = 'completed' } = ctx.request.body as any;

      // Validate queue name
      if (!['supplier-sync', 'product-family', 'image-upload'].includes(queue)) {
        return ctx.badRequest('Invalid queue name');
      }

      // Validate status
      if (!['completed', 'failed'].includes(status)) {
        return ctx.badRequest('Invalid status (completed or failed)');
      }

      // Validate grace period
      const graceNum = parseInt(grace, 10);

      if (isNaN(graceNum) || graceNum < 0) {
        return ctx.badRequest('Invalid grace period');
      }

      const result = await strapi
        .service('api::queue-manager.queue-manager')
        .cleanQueue(queue, graceNum, status);

      ctx.body = result;
    } catch (error) {
      strapi.log.error('Clean queue error:', error);
      ctx.internalServerError('Failed to clean queue');
    }
  },

  /**
   * POST /api/queue-manager/:queue/drain
   * Drain a queue (remove all jobs) - DANGEROUS
   */
  async drainQueue(ctx) {
    try {
      const { queue } = ctx.params;

      // Validate queue name
      if (!['supplier-sync', 'product-family', 'image-upload'].includes(queue)) {
        return ctx.badRequest('Invalid queue name');
      }

      const result = await strapi
        .service('api::queue-manager.queue-manager')
        .drainQueue(queue);

      ctx.body = result;
    } catch (error) {
      strapi.log.error('Drain queue error:', error);
      ctx.internalServerError('Failed to drain queue');
    }
  }

});
