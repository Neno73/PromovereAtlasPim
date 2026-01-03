/**
 * Queue Monitor
 * Periodically logs queue metrics and health status
 */

import { Queue } from 'bullmq';
import { getRedisConnection, QUEUE_NAMES } from './queue-config';

export class QueueMonitor {
    private queues: Queue[] = [];
    private intervalId: NodeJS.Timeout | null = null;
    private readonly intervalMs: number;

    constructor(intervalMs?: number) {
        // Default: 5 minutes (safer for production), configurable via env var
        const defaultInterval = parseInt(process.env.QUEUE_MONITOR_INTERVAL_MS || '300000', 10);
        this.intervalMs = intervalMs || defaultInterval;
        strapi.log.info(`Queue Monitor interval set to ${this.intervalMs}ms (${this.intervalMs / 1000}s)`);
    }

    /**
     * Initialize queues for monitoring (using prefixed names for environment isolation)
     */
    private initQueues() {
        const connection = getRedisConnection();
        const queueNames = Object.values(QUEUE_NAMES);

        this.queues = queueNames.map(name => new Queue(name, { connection }));
    }

    /**
     * Start monitoring
     */
    public start() {
        if (this.intervalId) {
            return;
        }

        this.initQueues();
        strapi.log.info(`📊 Queue Monitor started (interval: ${this.intervalMs}ms)`);

        // Initial check
        this.checkQueues();

        // Schedule periodic checks
        this.intervalId = setInterval(() => {
            this.checkQueues();
        }, this.intervalMs);
    }

    /**
     * Stop monitoring
     */
    public async stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        await Promise.all(this.queues.map(q => q.close()));
        this.queues = [];
        strapi.log.info('📊 Queue Monitor stopped');
    }

    /**
     * Check and log queue metrics
     */
    private async checkQueues() {
        try {
            const metrics = await Promise.all(
                this.queues.map(async (queue) => {
                    const counts = await queue.getJobCounts(
                        'waiting',
                        'active',
                        'failed',
                        'delayed'
                    );
                    return {
                        name: queue.name,
                        waiting: counts.waiting,
                        active: counts.active,
                        failed: counts.failed,
                        delayed: counts.delayed
                    };
                })
            );

            // Log summary
            const highLoadThreshold = parseInt(process.env.QUEUE_HIGH_LOAD_THRESHOLD || '100', 10);
            strapi.log.info('📊 [Queue Status]');
            metrics.forEach(m => {
                const status = `   - ${m.name.padEnd(20)} | Waiting: ${m.waiting.toString().padEnd(4)} | Active: ${m.active.toString().padEnd(4)} | Failed: ${m.failed.toString().padEnd(4)} | Delayed: ${m.delayed}`;

                if (m.failed > 0) {
                    strapi.log.warn(status);
                } else if (m.waiting > highLoadThreshold) {
                    strapi.log.warn(status + ' (High Load)');
                } else {
                    strapi.log.info(status);
                }
            });

        } catch (error) {
            strapi.log.error('❌ Queue Monitor failed to fetch metrics:', error);
        }
    }
}

// Export singleton
export default new QueueMonitor();
