/**
 * Sync Session Service
 *
 * Core business logic for managing sync sessions.
 * Provides methods for creating, updating, and querying sessions.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::sync-session.sync-session', ({ strapi }) => ({

  /**
   * Generate a unique session ID
   */
  generateSessionId(supplierCode: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `sess_${timestamp}_${supplierCode}_${random}`;
  },

  /**
   * Create a new sync session
   */
  async createSession(
    supplierId: number,
    supplierCode: string,
    triggeredBy: 'manual' | 'scheduled' | 'api' = 'manual'
  ) {
    const sessionId = this.generateSessionId(supplierCode);

    const session = await strapi.entityService.create('api::sync-session.sync-session', {
      data: {
        session_id: sessionId,
        supplier: supplierId,
        supplier_code: supplierCode,
        status: 'running',
        started_at: new Date(),
        triggered_by: triggeredBy,
        promidata_status: 'running',
        promidata_started_at: new Date(),
        images_status: 'pending',
        meilisearch_status: 'pending',
        gemini_status: 'pending',
        errors: [],
        error_count: 0
      }
    });

    strapi.log.info(`📋 [SyncSession] Created session ${sessionId} for ${supplierCode}`);
    return session;
  },

  /**
   * Update a session by session_id
   */
  async updateSession(sessionId: string, data: Record<string, any>) {
    // Find session by session_id
    const sessions = await strapi.entityService.findMany('api::sync-session.sync-session', {
      filters: { session_id: sessionId },
      limit: 1
    });

    if (sessions.length === 0) {
      strapi.log.warn(`[SyncSession] Session ${sessionId} not found`);
      return null;
    }

    const session = sessions[0];

    const updated = await strapi.entityService.update(
      'api::sync-session.sync-session',
      session.id,
      { data }
    );

    return updated;
  },

  /**
   * Update stage status
   */
  async updateStage(
    sessionId: string,
    stage: 'promidata' | 'images' | 'meilisearch' | 'gemini',
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped',
    stats?: Record<string, any>
  ) {
    const updateData: Record<string, any> = {
      [`${stage}_status`]: status
    };

    if (status === 'running' && !stats?.[`${stage}_started_at`]) {
      updateData[`${stage}_started_at`] = new Date();
    }

    if (status === 'completed' || status === 'failed' || status === 'skipped') {
      updateData[`${stage}_completed_at`] = new Date();
    }

    if (stats) {
      Object.keys(stats).forEach(key => {
        // Only add stage-specific stats
        if (key.startsWith(stage)) {
          updateData[key] = stats[key];
        }
      });
    }

    strapi.log.debug(`[SyncSession] Updating ${sessionId} stage ${stage} to ${status}`);
    return this.updateSession(sessionId, updateData);
  },

  /**
   * Increment a counter for a stage
   */
  async incrementStageCounter(
    sessionId: string,
    field: string,
    amount: number = 1
  ) {
    // Find session
    const sessions = await strapi.entityService.findMany('api::sync-session.sync-session', {
      filters: { session_id: sessionId },
      limit: 1
    });

    if (sessions.length === 0) {
      return null;
    }

    const session = sessions[0];
    const currentValue = session[field] || 0;

    return this.updateSession(sessionId, {
      [field]: currentValue + amount
    });
  },

  /**
   * Add an error to the session
   */
  async addError(
    sessionId: string,
    stage: string,
    error: string,
    details?: Record<string, any>
  ) {
    const sessions = await strapi.entityService.findMany('api::sync-session.sync-session', {
      filters: { session_id: sessionId },
      limit: 1
    });

    if (sessions.length === 0) {
      return null;
    }

    const session = sessions[0];
    const errors = (session.errors || []) as Array<{
      timestamp: string;
      stage: string;
      error: string;
      details?: any;
    }>;

    errors.push({
      timestamp: new Date().toISOString(),
      stage,
      error,
      details
    });

    // Keep only last 100 errors
    const trimmedErrors = errors.slice(-100);

    return this.updateSession(sessionId, {
      errors: trimmedErrors,
      last_error: error,
      error_count: (session.error_count || 0) + 1
    });
  },

  /**
   * Mark session as completed
   */
  async completeSession(sessionId: string) {
    const sessions = await strapi.entityService.findMany('api::sync-session.sync-session', {
      filters: { session_id: sessionId },
      limit: 1
    });

    if (sessions.length === 0) {
      return null;
    }

    const session = sessions[0];
    const startedAt = new Date(session.started_at);
    const completedAt = new Date();
    const durationSeconds = Math.round((completedAt.getTime() - startedAt.getTime()) / 1000);

    const updated = await this.updateSession(sessionId, {
      status: 'completed',
      completed_at: completedAt,
      duration_seconds: durationSeconds
    });

    strapi.log.info(`✅ [SyncSession] Session ${sessionId} completed in ${durationSeconds}s`);
    return updated;
  },

  /**
   * Mark session as failed
   */
  async failSession(sessionId: string, error: string) {
    const sessions = await strapi.entityService.findMany('api::sync-session.sync-session', {
      filters: { session_id: sessionId },
      limit: 1
    });

    if (sessions.length === 0) {
      return null;
    }

    const session = sessions[0];
    const startedAt = new Date(session.started_at);
    const completedAt = new Date();
    const durationSeconds = Math.round((completedAt.getTime() - startedAt.getTime()) / 1000);

    const updated = await this.updateSession(sessionId, {
      status: 'failed',
      completed_at: completedAt,
      duration_seconds: durationSeconds,
      last_error: error
    });

    strapi.log.error(`❌ [SyncSession] Session ${sessionId} failed: ${error}`);
    return updated;
  },

  /**
   * Check if previous stage completed successfully
   */
  async canProceedToStage(
    sessionId: string,
    stage: 'images' | 'meilisearch' | 'gemini'
  ): Promise<boolean> {
    const sessions = await strapi.entityService.findMany('api::sync-session.sync-session', {
      filters: { session_id: sessionId },
      limit: 1
    });

    if (sessions.length === 0) {
      return false;
    }

    const session = sessions[0];

    // Define stage dependencies
    const dependencies: Record<string, string> = {
      'images': 'promidata',
      'meilisearch': 'images',
      'gemini': 'meilisearch'
    };

    const prerequisite = dependencies[stage];
    if (!prerequisite) {
      return true;
    }

    const prerequisiteStatus = session[`${prerequisite}_status`];
    return prerequisiteStatus === 'completed' || prerequisiteStatus === 'skipped';
  },

  /**
   * Get session by session_id
   */
  async getBySessionId(sessionId: string) {
    const sessions = await strapi.entityService.findMany('api::sync-session.sync-session', {
      filters: { session_id: sessionId },
      limit: 1,
      populate: ['supplier']
    });

    return sessions.length > 0 ? sessions[0] : null;
  },

  /**
   * Get active session for a supplier (if any)
   */
  async getActiveSessionForSupplier(supplierCode: string) {
    const sessions = await strapi.entityService.findMany('api::sync-session.sync-session', {
      filters: {
        supplier_code: supplierCode,
        status: { $in: ['pending', 'running'] }
      },
      limit: 1,
      populate: ['supplier']
    });

    return sessions.length > 0 ? sessions[0] : null;
  },

  /**
   * Check if all jobs for a stage are complete
   */
  async checkStageCompletion(sessionId: string, stage: string): Promise<{
    complete: boolean;
    processed: number;
    total: number;
    failed: number;
  }> {
    const session = await this.getBySessionId(sessionId);
    if (!session) {
      return { complete: false, processed: 0, total: 0, failed: 0 };
    }

    let processed = 0;
    let total = 0;
    let failed = 0;

    switch (stage) {
      case 'images':
        total = session.images_total || 0;
        processed = (session.images_uploaded || 0) + (session.images_deduplicated || 0);
        failed = session.images_failed || 0;
        break;
      case 'meilisearch':
        total = session.meilisearch_total || 0;
        processed = session.meilisearch_indexed || 0;
        failed = session.meilisearch_failed || 0;
        break;
      case 'gemini':
        total = session.gemini_total || 0;
        processed = session.gemini_synced || 0;
        failed = session.gemini_failed || 0;
        break;
    }

    const complete = total > 0 && (processed + failed >= total);
    return { complete, processed, total, failed };
  }

}));
