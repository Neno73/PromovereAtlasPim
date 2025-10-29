/**
 * Queue Manager Routes
 * Admin-only routes for queue management and monitoring
 */

export default {
  routes: [
    // Queue Statistics
    {
      method: 'GET',
      path: '/queue-manager/stats',
      handler: 'queue-manager.getStats',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/queue-manager/stats/:queue',
      handler: 'queue-manager.getStats',
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // Worker Status
    {
      method: 'GET',
      path: '/queue-manager/workers',
      handler: 'queue-manager.getWorkers',
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // Job Listing
    {
      method: 'GET',
      path: '/queue-manager/:queue/jobs',
      handler: 'queue-manager.listJobs',
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // Job Details
    {
      method: 'GET',
      path: '/queue-manager/:queue/jobs/:jobId',
      handler: 'queue-manager.getJob',
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // Retry Job
    {
      method: 'POST',
      path: '/queue-manager/:queue/jobs/:jobId/retry',
      handler: 'queue-manager.retryJob',
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // Retry All Failed Jobs
    {
      method: 'POST',
      path: '/queue-manager/:queue/retry-failed',
      handler: 'queue-manager.retryFailedJobs',
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // Delete Job
    {
      method: 'DELETE',
      path: '/queue-manager/:queue/jobs/:jobId',
      handler: 'queue-manager.deleteJob',
      config: {
        policies: [],
        middlewares: [],
      },
    },

    // Queue Controls
    {
      method: 'POST',
      path: '/queue-manager/:queue/pause',
      handler: 'queue-manager.pauseQueue',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/queue-manager/:queue/resume',
      handler: 'queue-manager.resumeQueue',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/queue-manager/:queue/clean',
      handler: 'queue-manager.cleanQueue',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/queue-manager/:queue/drain',
      handler: 'queue-manager.drainQueue',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
