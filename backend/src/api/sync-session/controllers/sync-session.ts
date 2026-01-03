/**
 * Sync Session Controller
 *
 * Handles HTTP requests for sync session operations.
 * Provides endpoints for viewing, managing, and verifying sync sessions.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::sync-session.sync-session', ({ strapi }) => ({

  /**
   * GET /api/sync-sessions/active
   * Get all currently running sync sessions
   */
  async getActiveSessions(ctx) {
    try {
      const sessions = await strapi.entityService.findMany('api::sync-session.sync-session', {
        filters: {
          status: { $in: ['pending', 'running'] }
        },
        sort: { started_at: 'desc' },
        populate: ['supplier']
      });

      ctx.body = {
        success: true,
        data: sessions,
        count: sessions.length
      };
    } catch (error) {
      strapi.log.error('Failed to get active sessions:', error);
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * GET /api/sync-sessions/supplier/:supplierCode/history
   * Get sync history for a specific supplier
   */
  async getSupplierHistory(ctx) {
    try {
      const { supplierCode } = ctx.params;
      const { limit = 10 } = ctx.query;

      if (!supplierCode) {
        ctx.status = 400;
        ctx.body = { success: false, error: 'supplierCode is required' };
        return;
      }

      const sessions = await strapi.entityService.findMany('api::sync-session.sync-session', {
        filters: {
          supplier_code: supplierCode
        },
        sort: { started_at: 'desc' },
        limit: parseInt(limit as string, 10),
        populate: ['supplier']
      });

      ctx.body = {
        success: true,
        data: sessions,
        supplier_code: supplierCode,
        count: sessions.length
      };
    } catch (error) {
      strapi.log.error('Failed to get supplier history:', error);
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * GET /api/sync-sessions/:sessionId
   * Get detailed session information
   */
  async getSessionDetails(ctx) {
    try {
      const { sessionId } = ctx.params;

      if (!sessionId) {
        ctx.status = 400;
        ctx.body = { success: false, error: 'sessionId is required' };
        return;
      }

      const sessions = await strapi.entityService.findMany('api::sync-session.sync-session', {
        filters: {
          session_id: sessionId
        },
        populate: ['supplier']
      });

      if (sessions.length === 0) {
        ctx.status = 404;
        ctx.body = { success: false, error: 'Session not found' };
        return;
      }

      const session = sessions[0];

      // Calculate progress percentage
      const stages = ['promidata', 'images', 'meilisearch', 'gemini'];
      const completedStages = stages.filter(stage =>
        session[`${stage}_status`] === 'completed' || session[`${stage}_status`] === 'skipped'
      ).length;
      const progress = Math.round((completedStages / stages.length) * 100);

      ctx.body = {
        success: true,
        data: {
          ...session,
          progress,
          stages: stages.map(stage => ({
            name: stage,
            status: session[`${stage}_status`],
            started_at: session[`${stage}_started_at`],
            completed_at: session[`${stage}_completed_at`],
            stats: getStageStats(session, stage)
          }))
        }
      };
    } catch (error) {
      strapi.log.error('Failed to get session details:', error);
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * GET /api/sync-sessions/summary
   * Get summary of recent sync activity
   */
  async getSummary(ctx) {
    try {
      const { days = 7 } = ctx.query;
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(days as string, 10));

      const [totalSessions, completedSessions, failedSessions, activeSessions] = await Promise.all([
        strapi.entityService.count('api::sync-session.sync-session', {
          filters: { started_at: { $gte: daysAgo.toISOString() } }
        }),
        strapi.entityService.count('api::sync-session.sync-session', {
          filters: {
            started_at: { $gte: daysAgo.toISOString() },
            status: 'completed'
          }
        }),
        strapi.entityService.count('api::sync-session.sync-session', {
          filters: {
            started_at: { $gte: daysAgo.toISOString() },
            status: 'failed'
          }
        }),
        strapi.entityService.count('api::sync-session.sync-session', {
          filters: {
            status: { $in: ['pending', 'running'] }
          }
        })
      ]);

      // Get recent failures for alert
      const recentFailures = await strapi.entityService.findMany('api::sync-session.sync-session', {
        filters: {
          started_at: { $gte: daysAgo.toISOString() },
          status: 'failed'
        },
        sort: { started_at: 'desc' },
        limit: 5,
        populate: ['supplier']
      });

      ctx.body = {
        success: true,
        data: {
          period_days: parseInt(days as string, 10),
          total_sessions: totalSessions,
          completed: completedSessions,
          failed: failedSessions,
          active: activeSessions,
          success_rate: totalSessions > 0
            ? Math.round((completedSessions / totalSessions) * 100)
            : 100,
          recent_failures: recentFailures.map(f => ({
            session_id: f.session_id,
            supplier_code: f.supplier_code,
            last_error: f.last_error,
            started_at: f.started_at
          }))
        }
      };
    } catch (error) {
      strapi.log.error('Failed to get summary:', error);
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * GET /api/sync-sessions/verify/:sessionId
   * Verify session by comparing counts across systems
   */
  async verifySession(ctx) {
    try {
      const { sessionId } = ctx.params;

      if (!sessionId) {
        ctx.status = 400;
        ctx.body = { success: false, error: 'sessionId is required' };
        return;
      }

      const sessions = await strapi.entityService.findMany('api::sync-session.sync-session', {
        filters: { session_id: sessionId },
        populate: ['supplier']
      });

      if (sessions.length === 0) {
        ctx.status = 404;
        ctx.body = { success: false, error: 'Session not found' };
        return;
      }

      const session = sessions[0];
      const supplierCode = session.supplier_code;

      // Get actual counts from systems
      const [strapiProductCount, strapiVariantCount] = await Promise.all([
        strapi.entityService.count('api::product.product', {
          filters: { supplier: { code: supplierCode } }
        }),
        strapi.entityService.count('api::product-variant.product-variant', {
          filters: { product: { supplier: { code: supplierCode } } }
        })
      ]);

      // Get Meilisearch count via service
      let meilisearchCount = 0;
      try {
        // @ts-ignore
        const meilisearchService = strapi.service('api::product.meilisearch');
        if (meilisearchService) {
          const stats = await meilisearchService.getStats();
          meilisearchCount = stats?.numberOfDocuments || 0;
        }
      } catch (err) {
        strapi.log.warn('Could not get Meilisearch count:', err);
      }

      // Get Gemini count via service
      let geminiCount = 0;
      try {
        // @ts-ignore
        const geminiService = strapi.service('api::gemini-sync.gemini-file-search');
        if (geminiService) {
          const stats = await geminiService.getStats();
          geminiCount = stats?.syncedProducts || 0;
        }
      } catch (err) {
        strapi.log.warn('Could not get Gemini count:', err);
      }

      // Compare counts
      const verification = {
        session_id: sessionId,
        supplier_code: supplierCode,
        status: 'verified' as 'verified' | 'mismatch' | 'error',
        strapi: {
          products: strapiProductCount,
          variants: strapiVariantCount,
          session_tracked: session.promidata_families_created || 0
        },
        meilisearch: {
          documents: meilisearchCount,
          session_tracked: session.meilisearch_indexed || 0
        },
        gemini: {
          files: geminiCount,
          session_tracked: session.gemini_synced || 0
        },
        mismatches: [] as string[]
      };

      // Check for mismatches
      if (verification.strapi.products !== verification.strapi.session_tracked) {
        verification.mismatches.push(`Strapi products (${verification.strapi.products}) != session tracked (${verification.strapi.session_tracked})`);
      }
      if (verification.meilisearch.documents !== verification.meilisearch.session_tracked) {
        verification.mismatches.push(`Meilisearch documents (${verification.meilisearch.documents}) != session tracked (${verification.meilisearch.session_tracked})`);
      }
      if (verification.gemini.files !== verification.gemini.session_tracked) {
        verification.mismatches.push(`Gemini files (${verification.gemini.files}) != session tracked (${verification.gemini.session_tracked})`);
      }

      if (verification.mismatches.length > 0) {
        verification.status = 'mismatch';
      }

      // Update session with verification status
      await strapi.entityService.update('api::sync-session.sync-session', session.id, {
        data: {
          verification_status: verification.status,
          verification_details: verification
        }
      });

      ctx.body = {
        success: true,
        data: verification
      };
    } catch (error) {
      strapi.log.error('Failed to verify session:', error);
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * GET /api/sync-sessions/health
   * Get overall pipeline health status
   */
  async getPipelineHealth(ctx) {
    try {
      // Check recent sessions for errors
      const recentSessions = await strapi.entityService.findMany('api::sync-session.sync-session', {
        sort: { started_at: 'desc' },
        limit: 10
      });

      // Calculate health metrics
      const totalRecent = recentSessions.length;
      const failedRecent = recentSessions.filter(s => s.status === 'failed').length;
      const activeCount = recentSessions.filter(s => ['pending', 'running'].includes(s.status)).length;

      // Check queue health
      let queueHealth: { healthy: boolean; message: string; stats?: any } = { healthy: false, message: 'Queue status unknown' };
      try {
        // @ts-ignore
        const queueService = strapi.service('api::promidata-sync.queue');
        if (queueService && typeof queueService.getStats === 'function') {
          const queueStats = await queueService.getStats();
          queueHealth = {
            healthy: true,
            message: 'Queues operational',
            stats: queueStats
          };
        }
      } catch (err) {
        strapi.log.warn('Could not get queue health:', err);
      }

      // Check Meilisearch health
      let meilisearchHealth = { healthy: false, message: 'Meilisearch status unknown' };
      try {
        // @ts-ignore
        const meilisearchService = strapi.service('api::product.meilisearch');
        if (meilisearchService) {
          const isHealthy = await meilisearchService.healthCheck?.();
          meilisearchHealth = {
            healthy: isHealthy !== false,
            message: isHealthy !== false ? 'Meilisearch operational' : 'Meilisearch issues detected'
          };
        }
      } catch (err) {
        strapi.log.warn('Could not get Meilisearch health:', err);
      }

      // Check Gemini health
      let geminiHealth = { healthy: false, message: 'Gemini status unknown' };
      try {
        // @ts-ignore
        const geminiService = strapi.service('api::gemini-sync.gemini-file-search');
        if (geminiService) {
          const isHealthy = await geminiService.healthCheck?.();
          geminiHealth = {
            healthy: isHealthy !== false,
            message: isHealthy !== false ? 'Gemini FileSearchStore operational' : 'Gemini issues detected'
          };
        }
      } catch (err) {
        strapi.log.warn('Could not get Gemini health:', err);
      }

      // Overall health assessment
      const overallHealthy = failedRecent === 0 && queueHealth.healthy && meilisearchHealth.healthy && geminiHealth.healthy;

      ctx.body = {
        success: true,
        data: {
          overall_status: overallHealthy ? 'healthy' : 'degraded',
          active_syncs: activeCount,
          recent_sessions: {
            total: totalRecent,
            failed: failedRecent,
            success_rate: totalRecent > 0 ? Math.round(((totalRecent - failedRecent) / totalRecent) * 100) : 100
          },
          services: {
            queue: queueHealth,
            meilisearch: meilisearchHealth,
            gemini: geminiHealth
          },
          last_check: new Date().toISOString()
        }
      };
    } catch (error) {
      strapi.log.error('Failed to get pipeline health:', error);
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: error.message
      };
    }
  }

}));

/**
 * Helper to extract stage-specific stats
 */
function getStageStats(session: any, stage: string): Record<string, number> {
  switch (stage) {
    case 'promidata':
      return {
        products_found: session.promidata_products_found || 0,
        families_created: session.promidata_families_created || 0,
        families_updated: session.promidata_families_updated || 0,
        skipped_unchanged: session.promidata_skipped_unchanged || 0,
        hash_efficiency: session.promidata_hash_efficiency || 0
      };
    case 'images':
      return {
        total: session.images_total || 0,
        uploaded: session.images_uploaded || 0,
        deduplicated: session.images_deduplicated || 0,
        failed: session.images_failed || 0
      };
    case 'meilisearch':
      return {
        total: session.meilisearch_total || 0,
        indexed: session.meilisearch_indexed || 0,
        failed: session.meilisearch_failed || 0
      };
    case 'gemini':
      return {
        total: session.gemini_total || 0,
        synced: session.gemini_synced || 0,
        skipped: session.gemini_skipped || 0,
        failed: session.gemini_failed || 0
      };
    default:
      return {};
  }
}
