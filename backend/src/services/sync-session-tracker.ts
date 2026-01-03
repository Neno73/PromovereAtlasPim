/**
 * Sync Session Tracker
 *
 * Standalone service for tracking sync sessions across workers.
 * This is imported directly by workers (not via strapi.service()).
 *
 * Purpose:
 * - Centralized session management for the sync pipeline
 * - Thread-safe counter increments
 * - Stage gate verification
 *
 * Usage:
 *   import syncSessionTracker from '../../services/sync-session-tracker';
 *   await syncSessionTracker.incrementCounter(sessionId, 'images_uploaded');
 */

// Declare global strapi instance
declare const strapi: any;

export type SyncStage = 'promidata' | 'images' | 'meilisearch' | 'gemini';
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type SessionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'stopped';

export interface SyncSession {
  id: number;
  session_id: string;
  supplier: any;
  supplier_code: string;
  status: SessionStatus;
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;

  promidata_status: StageStatus;
  promidata_started_at?: string;
  promidata_completed_at?: string;
  promidata_products_found: number;
  promidata_families_created: number;
  promidata_families_updated: number;
  promidata_skipped_unchanged: number;
  promidata_hash_efficiency?: number;

  images_status: StageStatus;
  images_started_at?: string;
  images_completed_at?: string;
  images_total: number;
  images_uploaded: number;
  images_deduplicated: number;
  images_failed: number;

  meilisearch_status: StageStatus;
  meilisearch_started_at?: string;
  meilisearch_completed_at?: string;
  meilisearch_total: number;
  meilisearch_indexed: number;
  meilisearch_failed: number;

  gemini_status: StageStatus;
  gemini_started_at?: string;
  gemini_completed_at?: string;
  gemini_total: number;
  gemini_synced: number;
  gemini_skipped: number;
  gemini_failed: number;

  errors: Array<{ timestamp: string; stage: string; error: string; details?: any }>;
  last_error?: string;
  error_count: number;
}

class SyncSessionTracker {
  /**
   * Generate a unique session ID
   */
  generateSessionId(supplierCode: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `sess_${timestamp}_${supplierCode}_${random}`;
  }

  /**
   * Create a new sync session
   */
  async createSession(
    supplierId: number,
    supplierCode: string,
    triggeredBy: 'manual' | 'scheduled' | 'api' = 'manual'
  ): Promise<SyncSession> {
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
        error_count: 0,
        // Initialize all counters to 0
        promidata_products_found: 0,
        promidata_families_created: 0,
        promidata_families_updated: 0,
        promidata_skipped_unchanged: 0,
        images_total: 0,
        images_uploaded: 0,
        images_deduplicated: 0,
        images_failed: 0,
        meilisearch_total: 0,
        meilisearch_indexed: 0,
        meilisearch_failed: 0,
        gemini_total: 0,
        gemini_synced: 0,
        gemini_skipped: 0,
        gemini_failed: 0
      }
    });

    strapi.log.info(`📋 [Session] Created ${sessionId} for ${supplierCode}`);
    return session as SyncSession;
  }

  /**
   * Get session by session_id
   */
  async getSession(sessionId: string): Promise<SyncSession | null> {
    const sessions = await strapi.entityService.findMany('api::sync-session.sync-session', {
      filters: { session_id: sessionId },
      limit: 1,
      populate: ['supplier']
    });

    return sessions.length > 0 ? sessions[0] as SyncSession : null;
  }

  /**
   * Update session fields
   */
  async updateSession(sessionId: string, data: Partial<SyncSession>): Promise<SyncSession | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      strapi.log.warn(`[Session] ${sessionId} not found`);
      return null;
    }

    const updated = await strapi.entityService.update(
      'api::sync-session.sync-session',
      session.id,
      { data }
    );

    return updated as SyncSession;
  }

  /**
   * Start a stage
   */
  async startStage(sessionId: string, stage: SyncStage): Promise<void> {
    strapi.log.info(`▶️  [Session] Starting ${stage} for ${sessionId}`);

    await this.updateSession(sessionId, {
      [`${stage}_status`]: 'running',
      [`${stage}_started_at`]: new Date().toISOString()
    } as any);
  }

  /**
   * Complete a stage
   */
  async completeStage(
    sessionId: string,
    stage: SyncStage,
    stats?: Record<string, number>
  ): Promise<void> {
    const data: any = {
      [`${stage}_status`]: 'completed',
      [`${stage}_completed_at`]: new Date().toISOString()
    };

    if (stats) {
      Object.entries(stats).forEach(([key, value]) => {
        data[key] = value;
      });
    }

    await this.updateSession(sessionId, data);
    strapi.log.info(`✅ [Session] Completed ${stage} for ${sessionId}`);
  }

  /**
   * Fail a stage
   */
  async failStage(sessionId: string, stage: SyncStage, error: string): Promise<void> {
    await this.updateSession(sessionId, {
      [`${stage}_status`]: 'failed',
      [`${stage}_completed_at`]: new Date().toISOString(),
      last_error: error
    } as any);

    await this.addError(sessionId, stage, error);
    strapi.log.error(`❌ [Session] Failed ${stage} for ${sessionId}: ${error}`);
  }

  /**
   * Increment a counter atomically using raw SQL to prevent race conditions
   *
   * IMPORTANT: This uses atomic SQL increment (SET field = field + amount)
   * instead of read-modify-write to handle concurrent workers correctly.
   * With 10 concurrent image workers, read-modify-write loses updates.
   */
  async incrementCounter(
    sessionId: string,
    field: string,
    amount: number = 1
  ): Promise<number> {
    try {
      // Use raw SQL for atomic increment to prevent race conditions
      const knex = strapi.db.connection;

      // Use raw SQL for guaranteed atomic increment
      const result = await knex.raw(
        `UPDATE sync_sessions SET "${field}" = COALESCE("${field}", 0) + ? WHERE session_id = ? RETURNING "${field}"`,
        [amount, sessionId]
      );

      if (result?.rows?.[0]) {
        return result.rows[0][field] || amount;
      }

      return amount;
    } catch (error) {
      // Fallback: log error and return 0
      strapi.log.error(`[Session] Failed to increment ${field} for ${sessionId}:`, error);
      return 0;
    }
  }

  /**
   * Set a total count for a stage (for progress tracking)
   */
  async setStageTotal(
    sessionId: string,
    stage: SyncStage,
    total: number
  ): Promise<void> {
    await this.updateSession(sessionId, {
      [`${stage}_total`]: total
    } as any);
  }

  /**
   * Add an error to the session log
   */
  async addError(
    sessionId: string,
    stage: string,
    error: string,
    details?: Record<string, any>
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    const errors = session.errors || [];
    errors.push({
      timestamp: new Date().toISOString(),
      stage,
      error,
      details
    });

    // Keep only last 100 errors
    const trimmedErrors = errors.slice(-100);

    await strapi.entityService.update(
      'api::sync-session.sync-session',
      session.id,
      {
        data: {
          errors: trimmedErrors,
          last_error: error,
          error_count: (session.error_count || 0) + 1
        }
      }
    );
  }

  /**
   * Complete the entire session
   */
  async completeSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    const startedAt = new Date(session.started_at);
    const completedAt = new Date();
    const durationSeconds = Math.round((completedAt.getTime() - startedAt.getTime()) / 1000);

    await this.updateSession(sessionId, {
      status: 'completed',
      completed_at: completedAt.toISOString(),
      duration_seconds: durationSeconds
    } as any);

    strapi.log.info(`🏁 [Session] ${sessionId} completed in ${durationSeconds}s`);
  }

  /**
   * Fail the entire session
   */
  async failSession(sessionId: string, error: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    const startedAt = new Date(session.started_at);
    const completedAt = new Date();
    const durationSeconds = Math.round((completedAt.getTime() - startedAt.getTime()) / 1000);

    await this.updateSession(sessionId, {
      status: 'failed',
      completed_at: completedAt.toISOString(),
      duration_seconds: durationSeconds,
      last_error: error
    } as any);

    strapi.log.error(`💥 [Session] ${sessionId} failed: ${error}`);
  }

  /**
   * Check if previous stage completed (for stage gates)
   */
  async canProceedToStage(sessionId: string, stage: SyncStage): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;

    const dependencies: Record<SyncStage, SyncStage | null> = {
      'promidata': null,
      'images': 'promidata',
      'meilisearch': 'images',
      'gemini': 'meilisearch'
    };

    const prerequisite = dependencies[stage];
    if (!prerequisite) return true;

    const status = (session as any)[`${prerequisite}_status`];
    return status === 'completed' || status === 'skipped';
  }

  /**
   * Check if all jobs for a stage are done
   */
  async isStageComplete(sessionId: string, stage: SyncStage): Promise<{
    complete: boolean;
    processed: number;
    total: number;
    failed: number;
  }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return { complete: false, processed: 0, total: 0, failed: 0 };
    }

    let processed = 0;
    let total = 0;
    let failed = 0;

    switch (stage) {
      case 'promidata':
        total = session.promidata_products_found || 0;
        processed = session.promidata_families_created + session.promidata_families_updated;
        // Promidata stage is complete when families are created (not products)
        return {
          complete: session.promidata_status === 'completed',
          processed,
          total,
          failed: 0
        };

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
        // Gemini processed includes synced AND skipped (not in Meilisearch)
        processed = (session.gemini_synced || 0) + (session.gemini_skipped || 0);
        failed = session.gemini_failed || 0;
        break;
    }

    const complete = total > 0 && (processed + failed >= total);
    return { complete, processed, total, failed };
  }

  /**
   * Get active session for a supplier
   */
  async getActiveSessionForSupplier(supplierCode: string): Promise<SyncSession | null> {
    const sessions = await strapi.entityService.findMany('api::sync-session.sync-session', {
      filters: {
        supplier_code: supplierCode,
        status: { $in: ['pending', 'running'] }
      },
      limit: 1
    });

    return sessions.length > 0 ? sessions[0] as SyncSession : null;
  }
}

// Export singleton instance
export const syncSessionTracker = new SyncSessionTracker();
export default syncSessionTracker;
