/**
 * Sync Session Routes
 *
 * Custom routes for sync session management and viewing.
 */

export default {
  routes: [
    // Custom routes (must come before core routes)
    {
      method: 'GET',
      path: '/sync-sessions/active',
      handler: 'sync-session.getActiveSessions',
      config: {
        policies: [],
        middlewares: [],
        description: 'Get all currently running sync sessions',
        tag: {
          plugin: 'sync-session',
          name: 'Active Sessions'
        }
      }
    },
    {
      method: 'GET',
      path: '/sync-sessions/summary',
      handler: 'sync-session.getSummary',
      config: {
        policies: [],
        middlewares: [],
        description: 'Get summary of recent sync activity',
        tag: {
          plugin: 'sync-session',
          name: 'Summary'
        }
      }
    },
    {
      method: 'GET',
      path: '/sync-sessions/supplier/:supplierCode/history',
      handler: 'sync-session.getSupplierHistory',
      config: {
        policies: [],
        middlewares: [],
        description: 'Get sync history for a specific supplier',
        tag: {
          plugin: 'sync-session',
          name: 'Supplier History'
        }
      }
    },
    {
      method: 'GET',
      path: '/sync-sessions/details/:sessionId',
      handler: 'sync-session.getSessionDetails',
      config: {
        policies: [],
        middlewares: [],
        description: 'Get detailed information about a specific session',
        tag: {
          plugin: 'sync-session',
          name: 'Session Details'
        }
      }
    },
    {
      method: 'GET',
      path: '/sync-sessions/verify/:sessionId',
      handler: 'sync-session.verifySession',
      config: {
        policies: [],
        middlewares: [],
        description: 'Verify session counts across Strapi, Meilisearch, and Gemini',
        tag: {
          plugin: 'sync-session',
          name: 'Verify Session'
        }
      }
    },
    {
      method: 'GET',
      path: '/sync-sessions/health',
      handler: 'sync-session.getPipelineHealth',
      config: {
        policies: [],
        middlewares: [],
        description: 'Get overall pipeline health status',
        tag: {
          plugin: 'sync-session',
          name: 'Pipeline Health'
        }
      }
    },
    // Core routes (find, findOne, create, update, delete)
    {
      method: 'GET',
      path: '/sync-sessions',
      handler: 'sync-session.find',
      config: {
        policies: []
      }
    },
    {
      method: 'GET',
      path: '/sync-sessions/:id',
      handler: 'sync-session.findOne',
      config: {
        policies: []
      }
    }
  ]
};
