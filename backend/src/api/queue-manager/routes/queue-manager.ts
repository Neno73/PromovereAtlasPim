/**
 * Queue Manager Routes
 * Admin-only routes for queue management and monitoring
 * Authentication handled in controller middleware
 */

export default {
  routes: [
    // Queue Statistics
    {
      method: 'GET',
      path: '/queue-manager/stats',
      handler: 'queue-manager.getStats',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/queue-manager/stats/:queue',
      handler: 'queue-manager.getStats',
      config: {
        auth: false,
        policies: [],
      },
    },

    // Worker Status
    {
      method: 'GET',
      path: '/queue-manager/workers',
      handler: 'queue-manager.getWorkers',
      config: {
        auth: false,
        policies: [],
      },
    },

    // Job Listing
    {
      method: 'GET',
      path: '/queue-manager/:queue/jobs',
      handler: 'queue-manager.listJobs',
      config: {
        auth: false,
        policies: [],
      },
    },

    // Job Details
    {
      method: 'GET',
      path: '/queue-manager/:queue/jobs/:jobId',
      handler: 'queue-manager.getJob',
      config: {
        auth: false,
        policies: [],
      },
    },

    // Retry Job
    {
      method: 'POST',
      path: '/queue-manager/:queue/jobs/:jobId/retry',
      handler: 'queue-manager.retryJob',
      config: {
        auth: false,
        policies: [],
      },
    },

    // Retry All Failed Jobs
    {
      method: 'POST',
      path: '/queue-manager/:queue/retry-failed',
      handler: 'queue-manager.retryFailedJobs',
      config: {
        auth: false,
        policies: [],
      },
    },

    // Delete Job
    {
      method: 'DELETE',
      path: '/queue-manager/:queue/jobs/:jobId',
      handler: 'queue-manager.deleteJob',
      config: {
        auth: false,
        policies: [],
      },
    },

    // Queue Controls
    {
      method: 'POST',
      path: '/queue-manager/:queue/pause',
      handler: 'queue-manager.pauseQueue',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/queue-manager/:queue/resume',
      handler: 'queue-manager.resumeQueue',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/queue-manager/:queue/clean',
      handler: 'queue-manager.cleanQueue',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/queue-manager/:queue/drain',
      handler: 'queue-manager.drainQueue',
      config: {
        auth: false,
        policies: [],
      },
    },

    // Clean All Queues
    {
      method: 'POST',
      path: '/queue-manager/clean-all',
      handler: 'queue-manager.cleanAllQueues',
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
