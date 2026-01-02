/**
 * Sync Lock Service
 * Provides distributed locking and stop signaling for sync operations
 * Uses Redis for coordination across workers
 */

import Redis from 'ioredis';
import { getRedisConnection } from './queue/queue-config';

// Lock TTL in seconds (auto-expire if process crashes)
const LOCK_TTL_SECONDS = 3600; // 1 hour
const STOP_SIGNAL_TTL_SECONDS = 300; // 5 minutes

// Lock key prefixes
const PROMIDATA_LOCK_PREFIX = 'sync:promidata:lock:';
const GEMINI_LOCK_PREFIX = 'sync:gemini:lock:';
const PROMIDATA_STOP_PREFIX = 'sync:promidata:stop:';
const GEMINI_STOP_PREFIX = 'sync:gemini:stop:';

interface LockInfo {
  lockedAt: string;
  lockedBy: string;
  syncId: string;
}

interface SyncStatus {
  isRunning: boolean;
  lockInfo?: LockInfo;
  stopRequested: boolean;
}

class SyncLockService {
  private redis: Redis | null = null;
  private instanceId: string;
  private activeSyncsCache: {
    data: { promidata: Array<any>; gemini: Array<any> } | null;
    timestamp: number;
  } = { data: null, timestamp: 0 };
  private readonly CACHE_TTL_MS = 5000; // 5 seconds cache

  constructor() {
    // Unique ID for this Strapi instance
    this.instanceId = `strapi-${process.pid}-${Date.now()}`;
  }

  /**
   * Get or create Redis client (lazy initialization)
   */
  private getClient(): Redis {
    if (!this.redis) {
      const config = getRedisConnection();
      // Use URL-based connection (config.url contains the full Redis URL)
      this.redis = new Redis(config.url, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.redis.on('error', (err) => {
        strapi.log.error('[SyncLock] Redis connection error:', err.message);
      });
    }
    return this.redis;
  }

  /**
   * Generate unique sync ID
   */
  private generateSyncId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Invalidate the active syncs cache (call when locks change)
   */
  private invalidateCache(): void {
    this.activeSyncsCache = { data: null, timestamp: 0 };
  }

  // ==========================================
  // PROMIDATA SYNC LOCK METHODS
  // ==========================================

  /**
   * Acquire lock for Promidata supplier sync
   * Returns syncId if lock acquired, null if already locked
   */
  async acquirePromidataLock(supplierId: number | string): Promise<string | null> {
    const client = this.getClient();
    const lockKey = `${PROMIDATA_LOCK_PREFIX}${supplierId}`;
    const syncId = this.generateSyncId();

    const lockInfo: LockInfo = {
      lockedAt: new Date().toISOString(),
      lockedBy: this.instanceId,
      syncId,
    };

    // NX = only set if not exists, EX = expire after TTL
    const result = await client.set(
      lockKey,
      JSON.stringify(lockInfo),
      'EX',
      LOCK_TTL_SECONDS,
      'NX'
    );

    if (result === 'OK') {
      strapi.log.info(`[SyncLock] Acquired Promidata lock for supplier ${supplierId} (syncId: ${syncId})`);
      this.invalidateCache(); // Refresh dashboard cache
      return syncId;
    }

    strapi.log.warn(`[SyncLock] Failed to acquire Promidata lock for supplier ${supplierId} - already running`);
    return null;
  }

  /**
   * Release Promidata sync lock
   */
  async releasePromidataLock(supplierId: number | string): Promise<void> {
    const client = this.getClient();
    const lockKey = `${PROMIDATA_LOCK_PREFIX}${supplierId}`;
    const stopKey = `${PROMIDATA_STOP_PREFIX}${supplierId}`;

    await client.del(lockKey);
    await client.del(stopKey);
    this.invalidateCache(); // Refresh dashboard cache
    strapi.log.info(`[SyncLock] Released Promidata lock for supplier ${supplierId}`);
  }

  /**
   * Check if Promidata sync is running for supplier
   */
  async getPromidataStatus(supplierId: number | string): Promise<SyncStatus> {
    const client = this.getClient();
    const lockKey = `${PROMIDATA_LOCK_PREFIX}${supplierId}`;
    const stopKey = `${PROMIDATA_STOP_PREFIX}${supplierId}`;

    const [lockData, stopSignal] = await Promise.all([
      client.get(lockKey),
      client.get(stopKey),
    ]);

    return {
      isRunning: !!lockData,
      lockInfo: lockData ? JSON.parse(lockData) : undefined,
      stopRequested: !!stopSignal,
    };
  }

  /**
   * Request stop for Promidata sync
   */
  async requestPromidataStop(supplierId: number | string): Promise<boolean> {
    const client = this.getClient();
    const lockKey = `${PROMIDATA_LOCK_PREFIX}${supplierId}`;
    const stopKey = `${PROMIDATA_STOP_PREFIX}${supplierId}`;

    // Check if sync is running
    const lockExists = await client.exists(lockKey);
    if (!lockExists) {
      strapi.log.warn(`[SyncLock] No Promidata sync running for supplier ${supplierId}`);
      return false;
    }

    // Set stop signal
    await client.set(stopKey, 'true', 'EX', STOP_SIGNAL_TTL_SECONDS);
    strapi.log.info(`[SyncLock] Stop requested for Promidata sync supplier ${supplierId}`);
    return true;
  }

  /**
   * Check if stop was requested for Promidata sync
   */
  async isPromidataStopRequested(supplierId: number | string): Promise<boolean> {
    const client = this.getClient();
    const stopKey = `${PROMIDATA_STOP_PREFIX}${supplierId}`;
    const result = await client.get(stopKey);
    return result === 'true';
  }

  // ==========================================
  // GEMINI SYNC LOCK METHODS
  // ==========================================

  /**
   * Acquire lock for Gemini sync
   * supplierCode can be 'all' for full sync or specific supplier code
   */
  async acquireGeminiLock(supplierCode: string): Promise<string | null> {
    const client = this.getClient();
    const lockKey = `${GEMINI_LOCK_PREFIX}${supplierCode}`;
    const syncId = this.generateSyncId();

    const lockInfo: LockInfo = {
      lockedAt: new Date().toISOString(),
      lockedBy: this.instanceId,
      syncId,
    };

    const result = await client.set(
      lockKey,
      JSON.stringify(lockInfo),
      'EX',
      LOCK_TTL_SECONDS,
      'NX'
    );

    if (result === 'OK') {
      strapi.log.info(`[SyncLock] Acquired Gemini lock for ${supplierCode} (syncId: ${syncId})`);
      this.invalidateCache(); // Refresh dashboard cache
      return syncId;
    }

    strapi.log.warn(`[SyncLock] Failed to acquire Gemini lock for ${supplierCode} - already running`);
    return null;
  }

  /**
   * Release Gemini sync lock
   */
  async releaseGeminiLock(supplierCode: string): Promise<void> {
    const client = this.getClient();
    const lockKey = `${GEMINI_LOCK_PREFIX}${supplierCode}`;
    const stopKey = `${GEMINI_STOP_PREFIX}${supplierCode}`;

    await client.del(lockKey);
    await client.del(stopKey);
    this.invalidateCache(); // Refresh dashboard cache
    strapi.log.info(`[SyncLock] Released Gemini lock for ${supplierCode}`);
  }

  /**
   * Check if Gemini sync is running
   */
  async getGeminiStatus(supplierCode: string): Promise<SyncStatus> {
    const client = this.getClient();
    const lockKey = `${GEMINI_LOCK_PREFIX}${supplierCode}`;
    const stopKey = `${GEMINI_STOP_PREFIX}${supplierCode}`;

    const [lockData, stopSignal] = await Promise.all([
      client.get(lockKey),
      client.get(stopKey),
    ]);

    return {
      isRunning: !!lockData,
      lockInfo: lockData ? JSON.parse(lockData) : undefined,
      stopRequested: !!stopSignal,
    };
  }

  /**
   * Request stop for Gemini sync
   */
  async requestGeminiStop(supplierCode: string): Promise<boolean> {
    const client = this.getClient();
    const lockKey = `${GEMINI_LOCK_PREFIX}${supplierCode}`;
    const stopKey = `${GEMINI_STOP_PREFIX}${supplierCode}`;

    const lockExists = await client.exists(lockKey);
    if (!lockExists) {
      strapi.log.warn(`[SyncLock] No Gemini sync running for ${supplierCode}`);
      return false;
    }

    await client.set(stopKey, 'true', 'EX', STOP_SIGNAL_TTL_SECONDS);
    strapi.log.info(`[SyncLock] Stop requested for Gemini sync ${supplierCode}`);
    return true;
  }

  /**
   * Check if stop was requested for Gemini sync
   */
  async isGeminiStopRequested(supplierCode: string): Promise<boolean> {
    const client = this.getClient();
    const stopKey = `${GEMINI_STOP_PREFIX}${supplierCode}`;
    const result = await client.get(stopKey);
    return result === 'true';
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Scan for keys matching a pattern (SCAN is allowed on Upstash, KEYS is not)
   * Note: Increased COUNT to 10,000 for better performance when Redis has many keys
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const client = this.getClient();
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, foundKeys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 10000);
      cursor = nextCursor;
      keys.push(...foundKeys);
    } while (cursor !== '0');

    return keys;
  }

  /**
   * Get all active syncs (for admin dashboard)
   * Uses 5-second cache to prevent repeated Redis SCAN operations
   */
  async getAllActiveSyncs(): Promise<{
    promidata: Array<{ supplierId: string; lockInfo: LockInfo }>;
    gemini: Array<{ supplierCode: string; lockInfo: LockInfo }>;
  }> {
    // Check cache first
    const now = Date.now();
    if (this.activeSyncsCache.data && (now - this.activeSyncsCache.timestamp) < this.CACHE_TTL_MS) {
      return this.activeSyncsCache.data;
    }

    const client = this.getClient();

    // Get all lock keys using SCAN (KEYS is disabled on Upstash)
    const [promidataKeys, geminiKeys] = await Promise.all([
      this.scanKeys(`${PROMIDATA_LOCK_PREFIX}*`),
      this.scanKeys(`${GEMINI_LOCK_PREFIX}*`),
    ]);

    const promidata: Array<{ supplierId: string; lockInfo: LockInfo }> = [];
    const gemini: Array<{ supplierCode: string; lockInfo: LockInfo }> = [];

    // Get Promidata lock details
    for (const key of promidataKeys) {
      const data = await client.get(key);
      if (data) {
        const supplierId = key.replace(PROMIDATA_LOCK_PREFIX, '');
        promidata.push({ supplierId, lockInfo: JSON.parse(data) });
      }
    }

    // Get Gemini lock details
    for (const key of geminiKeys) {
      const data = await client.get(key);
      if (data) {
        const supplierCode = key.replace(GEMINI_LOCK_PREFIX, '');
        gemini.push({ supplierCode, lockInfo: JSON.parse(data) });
      }
    }

    const result = { promidata, gemini };

    // Update cache
    this.activeSyncsCache = {
      data: result,
      timestamp: now
    };

    return result;
  }

  /**
   * Force release all locks (emergency reset)
   */
  async forceReleaseAllLocks(): Promise<void> {
    const client = this.getClient();

    // Use SCAN instead of KEYS (KEYS is disabled on Upstash)
    const [promidataKeys, geminiKeys, promidataStopKeys, geminiStopKeys] = await Promise.all([
      this.scanKeys(`${PROMIDATA_LOCK_PREFIX}*`),
      this.scanKeys(`${GEMINI_LOCK_PREFIX}*`),
      this.scanKeys(`${PROMIDATA_STOP_PREFIX}*`),
      this.scanKeys(`${GEMINI_STOP_PREFIX}*`),
    ]);

    const allKeys = [...promidataKeys, ...geminiKeys, ...promidataStopKeys, ...geminiStopKeys];

    if (allKeys.length > 0) {
      await client.del(...allKeys);
      strapi.log.info(`[SyncLock] Force released ${allKeys.length} locks/signals`);
    }
  }

  /**
   * Cleanup on shutdown
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}

// Singleton export
export const syncLockService = new SyncLockService();
export default syncLockService;
