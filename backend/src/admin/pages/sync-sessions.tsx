import React, { useState, useEffect, useCallback } from "react";
import {
  Main,
  Box,
  Typography,
  Table,
  Thead,
  Tbody,
  Tr,
  Td,
  Th,
  Button,
  Badge,
  Flex,
  Loader,
  Divider,
  Alert,
} from "@strapi/design-system";
import { CheckCircle, Cross, Clock, ArrowClockwise, Eye, Information } from "@strapi/icons";
import { useFetchClient, useNotification } from "@strapi/strapi/admin";

// Types
interface SyncSession {
  id: number;
  session_id: string;
  supplier_code: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;

  promidata_status: string;
  promidata_products_found: number;
  promidata_families_created: number;
  promidata_families_updated: number;
  promidata_skipped_unchanged: number;

  images_status: string;
  images_total: number;
  images_uploaded: number;
  images_deduplicated: number;
  images_failed: number;

  meilisearch_status: string;
  meilisearch_total: number;
  meilisearch_indexed: number;
  meilisearch_failed: number;

  gemini_status: string;
  gemini_total: number;
  gemini_synced: number;
  gemini_skipped: number;
  gemini_failed: number;

  error_count: number;
  last_error?: string;
  supplier?: {
    name: string;
    code: string;
  };
}

interface PipelineHealth {
  overall_status: 'healthy' | 'degraded';
  active_syncs: number;
  recent_sessions: {
    total: number;
    failed: number;
    success_rate: number;
  };
  services: {
    queue: { healthy: boolean; message: string };
    meilisearch: { healthy: boolean; message: string };
    gemini: { healthy: boolean; message: string };
  };
  last_check: string;
}

interface SessionSummary {
  period_days: number;
  total_sessions: number;
  completed: number;
  failed: number;
  active: number;
  success_rate: number;
  recent_failures: Array<{
    session_id: string;
    supplier_code: string;
    last_error: string;
    started_at: string;
  }>;
}

const STAGE_ORDER = ['promidata', 'images', 'meilisearch', 'gemini'] as const;

const SyncSessionsPage = () => {
  const [sessions, setSessions] = useState<SyncSession[]>([]);
  const [activeSessions, setActiveSessions] = useState<SyncSession[]>([]);
  const [health, setHealth] = useState<PipelineHealth | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<SyncSession | null>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();

  const POLL_INTERVAL = 5000; // 5 seconds for active sessions

  const fetchData = useCallback(async () => {
    try {
      // Fetch all data in parallel
      const [sessionsRes, activeRes, healthRes, summaryRes] = await Promise.all([
        fetch('/api/sync-sessions?sort=started_at:desc&pagination[limit]=20'),
        fetch('/api/sync-sessions/active'),
        fetch('/api/sync-sessions/health'),
        fetch('/api/sync-sessions/summary?days=7'),
      ]);

      const [sessionsData, activeData, healthData, summaryData] = await Promise.all([
        sessionsRes.json(),
        activeRes.json(),
        healthRes.json(),
        summaryRes.json(),
      ]);

      if (sessionsData.data) setSessions(sessionsData.data);
      if (activeData.success) setActiveSessions(activeData.data);
      if (healthData.success) setHealth(healthData.data);
      if (summaryData.success) setSummary(summaryData.data);
    } catch (error) {
      console.error("Failed to fetch sync sessions:", error);
      toggleNotification({
        type: "warning",
        message: "Failed to load sync sessions",
      });
    } finally {
      setLoading(false);
    }
  }, [toggleNotification]);

  const fetchActiveSessions = useCallback(async () => {
    try {
      const activeRes = await fetch('/api/sync-sessions/active');
      const activeData = await activeRes.json();
      if (activeData.success) {
        setActiveSessions(activeData.data);
        // Also refresh the full session list to see progress
        const sessionsRes = await fetch('/api/sync-sessions?sort=started_at:desc&pagination[limit]=20');
        const sessionsData = await sessionsRes.json();
        if (sessionsData.data) setSessions(sessionsData.data);
      }
    } catch (error) {
      console.error("Failed to fetch active sessions:", error);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Poll for active session updates
    const pollInterval = setInterval(() => {
      if (activeSessions.length > 0) {
        fetchActiveSessions();
      }
    }, POLL_INTERVAL);

    return () => clearInterval(pollInterval);
  }, [activeSessions.length, fetchData, fetchActiveSessions]);

  const handleVerifySession = async (sessionId: string) => {
    setVerifying(true);
    try {
      const response = await fetch(`/api/sync-sessions/verify/${sessionId}`);
      const data = await response.json();

      if (data.success) {
        setVerificationResult(data.data);
        toggleNotification({
          type: data.data.status === 'verified' ? 'success' : 'warning',
          message: data.data.status === 'verified'
            ? 'Session verified successfully'
            : `Session has ${data.data.mismatches.length} mismatches`,
        });
      } else {
        toggleNotification({
          type: 'danger',
          message: data.error || 'Verification failed',
        });
      }
    } catch (error: any) {
      toggleNotification({
        type: 'danger',
        message: `Verification failed: ${error.message}`,
      });
    } finally {
      setVerifying(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, { bg: string; text: string }> = {
      pending: { bg: 'neutral200', text: 'neutral700' },
      running: { bg: 'secondary500', text: 'neutral0' },
      completed: { bg: 'success500', text: 'neutral0' },
      failed: { bg: 'danger500', text: 'neutral0' },
      stopped: { bg: 'warning500', text: 'neutral0' },
      skipped: { bg: 'neutral300', text: 'neutral700' },
    };

    const colors = statusColors[status] || statusColors.pending;

    return (
      <Badge backgroundColor={colors.bg} textColor={colors.text}>
        {status}
      </Badge>
    );
  };

  const getStageProgress = (session: SyncSession, stage: typeof STAGE_ORDER[number]) => {
    const statusKey = `${stage}_status` as keyof SyncSession;
    const status = session[statusKey] as string;

    let processed = 0;
    let total = 0;
    let failed = 0;

    switch (stage) {
      case 'promidata':
        processed = (session.promidata_families_created || 0) + (session.promidata_families_updated || 0);
        total = session.promidata_products_found || 0;
        break;
      case 'images':
        processed = (session.images_uploaded || 0) + (session.images_deduplicated || 0);
        total = session.images_total || 0;
        failed = session.images_failed || 0;
        break;
      case 'meilisearch':
        processed = session.meilisearch_indexed || 0;
        total = session.meilisearch_total || 0;
        failed = session.meilisearch_failed || 0;
        break;
      case 'gemini':
        processed = (session.gemini_synced || 0) + (session.gemini_skipped || 0);
        total = session.gemini_total || 0;
        failed = session.gemini_failed || 0;
        break;
    }

    const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

    return { status, processed, total, failed, percentage };
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <Main>
        <Box padding={8}>
          <Typography variant="alpha" tag="h1">
            Sync Sessions
          </Typography>
          <Box padding={8} background="neutral100" marginTop={4} hasRadius>
            <Flex direction="column" alignItems="center" gap={4}>
              <Loader />
              <Typography textAlign="center">Loading sync sessions...</Typography>
            </Flex>
          </Box>
        </Box>
      </Main>
    );
  }

  return (
    <Main>
      <Box padding={8}>
        <Flex justifyContent="space-between" alignItems="center" marginBottom={4}>
          <Box>
            <Typography variant="alpha" tag="h1">
              Sync Sessions
            </Typography>
            <Typography variant="omega" textColor="neutral600">
              Monitor and verify sync pipeline operations
            </Typography>
          </Box>
          <Button onClick={fetchData} startIcon={<ArrowClockwise />} variant="secondary">
            Refresh
          </Button>
        </Flex>

        {/* Pipeline Health Summary */}
        <Flex gap={4} marginBottom={6} wrap="wrap">
          {/* Health Status Card */}
          <Box background="neutral0" shadow="filterShadow" hasRadius padding={4}>
            <Typography variant="delta" fontWeight="bold" marginBottom={3}>
              Pipeline Health
            </Typography>
            {health && (
              <Flex direction="column" gap={3}>
                <Flex alignItems="center" gap={2}>
                  {health.overall_status === 'healthy' ? (
                    <CheckCircle fill="success500" />
                  ) : (
                    <Information fill="warning500" />
                  )}
                  <Typography fontWeight="semiBold" textColor={health.overall_status === 'healthy' ? 'success600' : 'warning600'}>
                    {health.overall_status === 'healthy' ? 'All Systems Operational' : 'Degraded Performance'}
                  </Typography>
                </Flex>
                <Divider />
                <Flex gap={4} wrap="wrap">
                  <Box>
                    <Typography variant="pi" textColor="neutral600">Queue</Typography>
                    <Typography fontWeight="semiBold" textColor={health.services.queue.healthy ? 'success600' : 'danger600'}>
                      {health.services.queue.healthy ? '✓' : '✗'} {health.services.queue.message}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="pi" textColor="neutral600">Meilisearch</Typography>
                    <Typography fontWeight="semiBold" textColor={health.services.meilisearch.healthy ? 'success600' : 'danger600'}>
                      {health.services.meilisearch.healthy ? '✓' : '✗'} {health.services.meilisearch.message}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="pi" textColor="neutral600">Gemini</Typography>
                    <Typography fontWeight="semiBold" textColor={health.services.gemini.healthy ? 'success600' : 'danger600'}>
                      {health.services.gemini.healthy ? '✓' : '✗'} {health.services.gemini.message}
                    </Typography>
                  </Box>
                </Flex>
              </Flex>
            )}
          </Box>

          {/* Summary Stats Card */}
          <Box background="neutral0" shadow="filterShadow" hasRadius padding={4}>
            <Typography variant="delta" fontWeight="bold" marginBottom={3}>
              Last 7 Days
            </Typography>
            {summary && (
              <Flex gap={6} wrap="wrap">
                <Box>
                  <Typography variant="pi" textColor="neutral600">Total Sessions</Typography>
                  <Typography variant="beta" fontWeight="bold">{summary.total_sessions}</Typography>
                </Box>
                <Box>
                  <Typography variant="pi" textColor="neutral600">Completed</Typography>
                  <Typography variant="beta" fontWeight="bold" textColor="success600">{summary.completed}</Typography>
                </Box>
                <Box>
                  <Typography variant="pi" textColor="neutral600">Failed</Typography>
                  <Typography variant="beta" fontWeight="bold" textColor="danger600">{summary.failed}</Typography>
                </Box>
                <Box>
                  <Typography variant="pi" textColor="neutral600">Active</Typography>
                  <Typography variant="beta" fontWeight="bold" textColor="secondary600">{summary.active}</Typography>
                </Box>
                <Box>
                  <Typography variant="pi" textColor="neutral600">Success Rate</Typography>
                  <Typography variant="beta" fontWeight="bold" textColor={summary.success_rate >= 90 ? 'success600' : 'warning600'}>
                    {summary.success_rate}%
                  </Typography>
                </Box>
              </Flex>
            )}
          </Box>
        </Flex>

        {/* Active Sessions */}
        {activeSessions.length > 0 && (
          <Box marginBottom={6}>
            <Typography variant="delta" fontWeight="bold" marginBottom={3}>
              Active Sync Sessions ({activeSessions.length})
            </Typography>
            <Box background="neutral0" shadow="filterShadow" hasRadius padding={4}>
              {activeSessions.map((session) => (
                <Box key={session.session_id} marginBottom={4} paddingBottom={4} style={{ borderBottom: '1px solid #eaeaea' }}>
                  <Flex justifyContent="space-between" alignItems="center" marginBottom={3}>
                    <Flex alignItems="center" gap={3}>
                      <Loader small />
                      <Box>
                        <Typography fontWeight="bold">{session.supplier?.name || session.supplier_code}</Typography>
                        <Typography variant="pi" textColor="neutral600">
                          {session.session_id} • Started {formatDate(session.started_at)}
                        </Typography>
                      </Box>
                    </Flex>
                    {getStatusBadge(session.status)}
                  </Flex>

                  {/* Stage Progress */}
                  <Flex gap={2} alignItems="center">
                    {STAGE_ORDER.map((stage, index) => {
                      const progress = getStageProgress(session, stage);
                      return (
                        <React.Fragment key={stage}>
                          <Box flex={1}>
                            <Flex justifyContent="space-between" alignItems="center" marginBottom={1}>
                              <Typography variant="pi" fontWeight="semiBold" style={{ textTransform: 'capitalize' }}>
                                {stage}
                              </Typography>
                              <Typography variant="pi" textColor="neutral600">
                                {progress.processed}/{progress.total}
                              </Typography>
                            </Flex>
                            <Box background="neutral200" hasRadius style={{ height: '6px', overflow: 'hidden' }}>
                              <Box
                                background={progress.status === 'failed' ? 'danger500' : 'success500'}
                                style={{ height: '100%', width: `${progress.percentage}%`, transition: 'width 0.3s' }}
                              />
                            </Box>
                            <Flex justifyContent="space-between" marginTop={1}>
                              {getStatusBadge(progress.status)}
                              {progress.failed > 0 && (
                                <Typography variant="pi" textColor="danger600">
                                  {progress.failed} failed
                                </Typography>
                              )}
                            </Flex>
                          </Box>
                          {index < STAGE_ORDER.length - 1 && (
                            <Typography textColor="neutral400">→</Typography>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </Flex>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Recent Sessions Table */}
        <Box>
          <Typography variant="delta" fontWeight="bold" marginBottom={3}>
            Recent Sessions
          </Typography>
          <Box background="neutral0" shadow="filterShadow" hasRadius>
            <Table colCount={8} rowCount={sessions.length}>
              <Thead>
                <Tr>
                  <Th><Typography variant="sigma">Session ID</Typography></Th>
                  <Th><Typography variant="sigma">Supplier</Typography></Th>
                  <Th><Typography variant="sigma">Status</Typography></Th>
                  <Th><Typography variant="sigma">Promidata</Typography></Th>
                  <Th><Typography variant="sigma">Images</Typography></Th>
                  <Th><Typography variant="sigma">Meilisearch</Typography></Th>
                  <Th><Typography variant="sigma">Gemini</Typography></Th>
                  <Th><Typography variant="sigma">Actions</Typography></Th>
                </Tr>
              </Thead>
              <Tbody>
                {sessions.map((session) => (
                  <Tr key={session.id}>
                    <Td>
                      <Box>
                        <Typography variant="omega" fontWeight="semiBold">
                          {session.session_id.slice(0, 20)}...
                        </Typography>
                        <Typography variant="pi" textColor="neutral600">
                          {formatDate(session.started_at)}
                        </Typography>
                      </Box>
                    </Td>
                    <Td>
                      <Typography>{session.supplier?.name || session.supplier_code}</Typography>
                    </Td>
                    <Td>
                      <Flex direction="column" gap={1}>
                        {getStatusBadge(session.status)}
                        {session.duration_seconds && (
                          <Typography variant="pi" textColor="neutral600">
                            {formatDuration(session.duration_seconds)}
                          </Typography>
                        )}
                      </Flex>
                    </Td>
                    <Td>
                      <Flex direction="column" gap={1}>
                        {getStatusBadge(session.promidata_status)}
                        <Typography variant="pi" textColor="neutral600">
                          {session.promidata_families_created || 0} created
                        </Typography>
                      </Flex>
                    </Td>
                    <Td>
                      <Flex direction="column" gap={1}>
                        {getStatusBadge(session.images_status)}
                        <Typography variant="pi" textColor="neutral600">
                          {session.images_uploaded || 0}/{session.images_total || 0}
                        </Typography>
                      </Flex>
                    </Td>
                    <Td>
                      <Flex direction="column" gap={1}>
                        {getStatusBadge(session.meilisearch_status)}
                        <Typography variant="pi" textColor="neutral600">
                          {session.meilisearch_indexed || 0}/{session.meilisearch_total || 0}
                        </Typography>
                      </Flex>
                    </Td>
                    <Td>
                      <Flex direction="column" gap={1}>
                        {getStatusBadge(session.gemini_status)}
                        <Typography variant="pi" textColor="neutral600">
                          {session.gemini_synced || 0}/{session.gemini_total || 0}
                        </Typography>
                      </Flex>
                    </Td>
                    <Td>
                      <Flex gap={2}>
                        <Button
                          onClick={() => {
                            setSelectedSession(session);
                            setShowDetailsModal(true);
                          }}
                          variant="tertiary"
                          size="S"
                          startIcon={<Eye />}
                        >
                          Details
                        </Button>
                        {session.status === 'completed' && (
                          <Button
                            onClick={() => handleVerifySession(session.session_id)}
                            loading={verifying}
                            variant="secondary"
                            size="S"
                            startIcon={<CheckCircle />}
                          >
                            Verify
                          </Button>
                        )}
                      </Flex>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        </Box>

        {/* Recent Failures Alert */}
        {summary && summary.recent_failures.length > 0 && (
          <Box marginTop={6}>
            <Alert variant="danger" title="Recent Failures">
              <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                {summary.recent_failures.map((failure) => (
                  <li key={failure.session_id}>
                    <Typography variant="pi">
                      <strong>{failure.supplier_code}</strong>: {failure.last_error || 'Unknown error'}
                      <span style={{ color: '#8e8ea9', marginLeft: '8px' }}>
                        {formatDate(failure.started_at)}
                      </span>
                    </Typography>
                  </li>
                ))}
              </ul>
            </Alert>
          </Box>
        )}

        {/* Session Details Panel */}
        {showDetailsModal && selectedSession && (
          <Box marginTop={6} background="neutral0" shadow="filterShadow" hasRadius padding={6}>
            <Flex justifyContent="space-between" alignItems="center" marginBottom={4}>
              <Typography variant="delta" fontWeight="bold">
                Session Details: {selectedSession.session_id.slice(0, 30)}...
              </Typography>
              <Flex gap={2}>
                {selectedSession.status === 'completed' && (
                  <Button
                    onClick={() => handleVerifySession(selectedSession.session_id)}
                    loading={verifying}
                    variant="secondary"
                    size="S"
                    startIcon={<CheckCircle />}
                  >
                    Verify
                  </Button>
                )}
                <Button onClick={() => setShowDetailsModal(false)} variant="tertiary" size="S">
                  Close
                </Button>
              </Flex>
            </Flex>

            <Flex direction="column" gap={4}>
              {/* Basic Info */}
              <Box>
                <Typography variant="sigma" textColor="neutral600" marginBottom={2}>BASIC INFORMATION</Typography>
                <Flex gap={6} wrap="wrap">
                  <Box>
                    <Typography variant="pi" textColor="neutral600">Supplier</Typography>
                    <Typography fontWeight="semiBold">{selectedSession.supplier?.name || selectedSession.supplier_code}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="pi" textColor="neutral600">Status</Typography>
                    <Box marginTop={1}>{getStatusBadge(selectedSession.status)}</Box>
                  </Box>
                  <Box>
                    <Typography variant="pi" textColor="neutral600">Started</Typography>
                    <Typography fontWeight="semiBold">{formatDate(selectedSession.started_at)}</Typography>
                  </Box>
                  {selectedSession.completed_at && (
                    <Box>
                      <Typography variant="pi" textColor="neutral600">Completed</Typography>
                      <Typography fontWeight="semiBold">{formatDate(selectedSession.completed_at)}</Typography>
                    </Box>
                  )}
                  {selectedSession.duration_seconds && (
                    <Box>
                      <Typography variant="pi" textColor="neutral600">Duration</Typography>
                      <Typography fontWeight="semiBold">{formatDuration(selectedSession.duration_seconds)}</Typography>
                    </Box>
                  )}
                </Flex>
              </Box>

              <Divider />

              {/* Stage Details */}
              <Box>
                <Typography variant="sigma" textColor="neutral600" marginBottom={3}>STAGE BREAKDOWN</Typography>
                <Flex gap={4} wrap="wrap">
                  {STAGE_ORDER.map((stage) => {
                    const progress = getStageProgress(selectedSession, stage);
                    return (
                      <Box key={stage} background="neutral100" padding={3} hasRadius style={{ minWidth: '200px', flex: 1 }}>
                        <Flex justifyContent="space-between" alignItems="center" marginBottom={2}>
                          <Typography fontWeight="bold" style={{ textTransform: 'capitalize' }}>
                            {stage}
                          </Typography>
                          {getStatusBadge(progress.status)}
                        </Flex>
                        <Typography variant="pi" textColor="neutral600">
                          {progress.processed}/{progress.total} ({progress.percentage}%)
                        </Typography>
                        {progress.failed > 0 && (
                          <Typography variant="pi" textColor="danger600">
                            {progress.failed} failed
                          </Typography>
                        )}
                        {stage === 'promidata' && (
                          <Box marginTop={2}>
                            <Typography variant="pi">Created: {selectedSession.promidata_families_created}</Typography>
                            <Typography variant="pi"> | Updated: {selectedSession.promidata_families_updated}</Typography>
                          </Box>
                        )}
                        {stage === 'images' && (
                          <Box marginTop={2}>
                            <Typography variant="pi">Uploaded: {selectedSession.images_uploaded}</Typography>
                            <Typography variant="pi"> | Dedup: {selectedSession.images_deduplicated}</Typography>
                          </Box>
                        )}
                        {stage === 'gemini' && (
                          <Box marginTop={2}>
                            <Typography variant="pi">Synced: {selectedSession.gemini_synced}</Typography>
                            <Typography variant="pi"> | Skipped: {selectedSession.gemini_skipped}</Typography>
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Flex>
              </Box>

              {/* Errors */}
              {selectedSession.error_count > 0 && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="sigma" textColor="danger600" marginBottom={2}>
                      ERRORS ({selectedSession.error_count})
                    </Typography>
                    {selectedSession.last_error && (
                      <Alert variant="danger">
                        <Typography variant="pi">{selectedSession.last_error}</Typography>
                      </Alert>
                    )}
                  </Box>
                </>
              )}

              {/* Verification Result */}
              {verificationResult && verificationResult.session_id === selectedSession.session_id && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="sigma" textColor="neutral600" marginBottom={2}>
                      VERIFICATION RESULT
                    </Typography>
                    <Alert variant={verificationResult.status === 'verified' ? 'success' : 'warning'}>
                      <Typography variant="pi" fontWeight="semiBold">
                        Status: {verificationResult.status}
                      </Typography>
                      {verificationResult.mismatches.length > 0 && (
                        <ul style={{ margin: '8px 0 0 0', paddingLeft: '1rem' }}>
                          {verificationResult.mismatches.map((m: string, i: number) => (
                            <li key={i}><Typography variant="pi">{m}</Typography></li>
                          ))}
                        </ul>
                      )}
                    </Alert>
                  </Box>
                </>
              )}
            </Flex>
          </Box>
        )}
      </Box>
    </Main>
  );
};

export default SyncSessionsPage;
