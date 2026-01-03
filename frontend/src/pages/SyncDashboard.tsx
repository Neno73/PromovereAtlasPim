import { useState, useEffect, FC } from 'react';
import { apiService } from '../services/api';
import './SyncDashboard.css';

interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export const SyncDashboard: FC = () => {
  const [queues, setQueues] = useState<QueueStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadQueueStats = async () => {
    try {
      setError(null);
      const response = await apiService.getQueueStats();

      if (response.success) {
        setQueues(response.data.queues);
        setLastUpdated(new Date());
      } else {
        setError('Failed to load queue stats');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue stats');
      console.error('Failed to load queue stats:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadQueueStats();
  }, []);

  // Auto-refresh every 5 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadQueueStats();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Format queue name for display
  const formatQueueName = (name: string): string => {
    return name
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  // Get queue icon
  const getQueueIcon = (name: string): string => {
    switch (name) {
      case 'supplier-sync':
        return '📦';
      case 'product-family':
        return '👨‍👩‍👧‍👦';
      case 'image-upload':
        return '🖼️';
      case 'meilisearch-sync':
        return '🔍';
      case 'gemini-sync':
        return '🤖';
      default:
        return '📊';
    }
  };

  // Calculate total stats
  const totalStats = queues.reduce(
    (acc, q) => ({
      waiting: acc.waiting + q.waiting,
      active: acc.active + q.active,
      completed: acc.completed + q.completed,
      failed: acc.failed + q.failed,
      delayed: acc.delayed + q.delayed,
    }),
    { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }
  );

  return (
    <div className="sync-dashboard">
      <div className="dashboard-header">
        <h1>Sync Dashboard</h1>
        <p className="dashboard-subtitle">BullMQ Queue Statistics</p>
      </div>

      <div className="dashboard-controls">
        <button
          className="refresh-btn"
          onClick={loadQueueStats}
          disabled={loading}
        >
          {loading ? 'Loading...' : '🔄 Refresh'}
        </button>

        <label className="auto-refresh-toggle">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          <span>Auto-refresh (5s)</span>
        </label>

        {lastUpdated && (
          <span className="last-updated">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {error && (
        <div className="error-message">
          <p>⚠️ {error}</p>
          <button onClick={loadQueueStats}>Retry</button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card waiting">
              <div className="card-value">{totalStats.waiting}</div>
              <div className="card-label">Waiting</div>
            </div>
            <div className="summary-card active">
              <div className="card-value">{totalStats.active}</div>
              <div className="card-label">Active</div>
            </div>
            <div className="summary-card completed">
              <div className="card-value">{totalStats.completed.toLocaleString()}</div>
              <div className="card-label">Completed</div>
            </div>
            <div className="summary-card failed">
              <div className="card-value">{totalStats.failed}</div>
              <div className="card-label">Failed</div>
            </div>
          </div>

          {/* Queue List */}
          <div className="queues-section">
            <h2>Queue Details</h2>
            <div className="queues-grid">
              {queues.map((queue) => (
                <div key={queue.name} className="queue-card">
                  <div className="queue-header">
                    <span className="queue-icon">{getQueueIcon(queue.name)}</span>
                    <h3 className="queue-name">{formatQueueName(queue.name)}</h3>
                  </div>

                  <div className="queue-stats">
                    <div className="stat">
                      <span className="stat-value waiting">{queue.waiting}</span>
                      <span className="stat-label">Waiting</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value active">{queue.active}</span>
                      <span className="stat-label">Active</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value completed">{queue.completed.toLocaleString()}</span>
                      <span className="stat-label">Completed</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value failed">{queue.failed}</span>
                      <span className="stat-label">Failed</span>
                    </div>
                    {queue.delayed > 0 && (
                      <div className="stat">
                        <span className="stat-value delayed">{queue.delayed}</span>
                        <span className="stat-label">Delayed</span>
                      </div>
                    )}
                  </div>

                  {/* Status indicator */}
                  <div className={`queue-status ${queue.active > 0 ? 'running' : queue.waiting > 0 ? 'pending' : 'idle'}`}>
                    {queue.active > 0 ? '🟢 Running' : queue.waiting > 0 ? '🟡 Pending' : '⚪ Idle'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bull Board Link */}
          <div className="bull-board-link">
            <a
              href="http://localhost:1337/admin/queue-dashboard"
              target="_blank"
              rel="noopener noreferrer"
            >
              📊 Open Bull Board for detailed job management →
            </a>
          </div>
        </>
      )}

      {loading && queues.length === 0 && (
        <div className="loading-state">
          <p>Loading queue statistics...</p>
        </div>
      )}
    </div>
  );
};
