/**
 * Job Details Modal Component
 * Shows detailed information about a job including data, progress, and errors
 */

import React from 'react';
import {
  Modal,
  Typography,
  Box,
  Flex,
  Badge,
  Button,
  Divider,
} from '@strapi/design-system';
import type { JobDetails } from '../../api/queueManager';

interface JobDetailsModalProps {
  job: JobDetails | null;
  isOpen: boolean;
  onClose: () => void;
}

const JobDetailsModal: React.FC<JobDetailsModalProps> = ({ job, isOpen, onClose }) => {
  if (!job) return null;

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const getStateBadgeVariant = (state: string, failedReason?: string) => {
    // Check if this is a parent-child dependency issue
    const isPendingDependencies = failedReason?.includes('pending dependencies');

    const variants: Record<string, any> = {
      waiting: 'secondary',
      active: 'success',
      completed: 'success',
      failed: isPendingDependencies ? 'warning' : 'danger', // Warning for dependency issues
      delayed: 'warning',
    };
    return variants[state] || 'neutral';
  };

  const getStateLabel = (state: string, failedReason?: string) => {
    const isPendingDependencies = failedReason?.includes('pending dependencies');

    if (state === 'failed' && isPendingDependencies) {
      return 'waiting for children';
    }
    return state;
  };

  /**
   * Truncate JSON string to prevent browser crashes with large payloads
   * @param obj - Object to stringify
   * @param maxLength - Maximum string length (default: 10000 chars)
   */
  const truncateJsonString = (obj: any, maxLength = 10000): string => {
    const str = JSON.stringify(obj, null, 2);
    if (str.length > maxLength) {
      return str.substring(0, maxLength) + '\n\n... (truncated - payload too large)';
    }
    return str;
  };

  return (
    <Modal.Root open={isOpen} onOpenChange={onClose}>
      <Modal.Content>
        <Modal.Header>
          <Flex justifyContent="space-between" alignItems="center" width="100%">
            <Modal.Title>Job Details</Modal.Title>
            <Badge variant={getStateBadgeVariant(job.state, job.failedReason)}>
              {getStateLabel(job.state, job.failedReason)}
            </Badge>
          </Flex>
        </Modal.Header>

        <Modal.Body>
          <Flex direction="column" gap={4}>
            {/* Job ID */}
            <Box>
              <Typography variant="sigma" textColor="neutral600">
                Job ID
              </Typography>
              <Typography
                variant="omega"
                fontWeight="semiBold"
                style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
              >
                {job.id}
              </Typography>
            </Box>

            <Divider />

            {/* Timestamps */}
            <Box>
              <Typography variant="sigma" textColor="neutral600">
                Timestamps
              </Typography>
              <Flex direction="column" gap={2} paddingTop={2}>
                <Flex justifyContent="space-between">
                  <Typography variant="pi">Created:</Typography>
                  <Typography variant="pi" fontWeight="semiBold">
                    {formatTimestamp(job.timestamp)}
                  </Typography>
                </Flex>
                {job.processedOn && (
                  <Flex justifyContent="space-between">
                    <Typography variant="pi">Processed:</Typography>
                    <Typography variant="pi" fontWeight="semiBold">
                      {formatTimestamp(job.processedOn)}
                    </Typography>
                  </Flex>
                )}
                {job.finishedOn && (
                  <Flex justifyContent="space-between">
                    <Typography variant="pi">Finished:</Typography>
                    <Typography variant="pi" fontWeight="semiBold">
                      {formatTimestamp(job.finishedOn)}
                    </Typography>
                  </Flex>
                )}
                <Flex justifyContent="space-between">
                  <Typography variant="pi">Attempts:</Typography>
                  <Typography variant="pi" fontWeight="semiBold">
                    {job.attemptsMade} / {job.opts?.attempts || 'N/A'}
                  </Typography>
                </Flex>
              </Flex>
            </Box>

            <Divider />

            {/* Progress */}
            {job.progress && (
              <>
                <Box>
                  <Typography variant="sigma" textColor="neutral600">
                    Progress
                  </Typography>
                  <Flex direction="column" gap={2} paddingTop={2}>
                    <Flex justifyContent="space-between">
                      <Typography variant="pi">Step:</Typography>
                      <Typography variant="pi" fontWeight="semiBold">
                        {job.progress.step.replace(/_/g, ' ')}
                      </Typography>
                    </Flex>
                    <Flex justifyContent="space-between">
                      <Typography variant="pi">Percentage:</Typography>
                      <Typography variant="pi" fontWeight="semiBold">
                        {job.progress.percentage}%
                      </Typography>
                    </Flex>
                  </Flex>
                </Box>
                <Divider />
              </>
            )}

            {/* Job Data */}
            <Box>
              <Typography variant="sigma" textColor="neutral600">
                Job Data
              </Typography>
              <Box
                paddingTop={2}
                background="neutral100"
                padding={3}
                hasRadius
                style={{ overflow: 'auto', maxHeight: '200px' }}
              >
                <pre style={{ margin: 0, fontSize: '12px' }}>
                  {truncateJsonString(job.data)}
                </pre>
              </Box>
            </Box>

            {/* Result (if completed) */}
            {job.returnvalue && (
              <>
                <Divider />
                <Box>
                  <Typography variant="sigma" textColor="neutral600">
                    Result
                  </Typography>
                  <Box
                    paddingTop={2}
                    background="success100"
                    padding={3}
                    hasRadius
                    style={{ overflow: 'auto', maxHeight: '200px' }}
                  >
                    <pre style={{ margin: 0, fontSize: '12px' }}>
                      {truncateJsonString(job.returnvalue)}
                    </pre>
                  </Box>
                </Box>
              </>
            )}

            {/* Error (if failed) */}
            {job.failedReason && (
              <>
                <Divider />
                <Box>
                  <Typography
                    variant="sigma"
                    textColor={job.failedReason.includes('pending dependencies') ? 'warning600' : 'danger600'}
                  >
                    {job.failedReason.includes('pending dependencies') ? 'Status' : 'Error'}
                  </Typography>
                  <Box paddingTop={2}>
                    <Typography
                      variant="pi"
                      textColor={job.failedReason.includes('pending dependencies') ? 'warning700' : 'danger600'}
                    >
                      {job.failedReason}
                    </Typography>
                    {job.failedReason.includes('pending dependencies') && (
                      <Box paddingTop={2} paddingLeft={2} background="warning100" padding={2} hasRadius marginTop={2}>
                        <Typography variant="pi" textColor="warning700" fontSize={1}>
                          ℹ️ This is a parent job waiting for child jobs to complete (e.g., image uploads).
                          This is normal and not an actual failure. The job will complete once all child jobs finish.
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              </>
            )}

            {/* Stack Trace (if failed) */}
            {job.stacktrace && job.stacktrace.length > 0 && (
              <Box>
                <Typography variant="sigma" textColor="danger600">
                  Stack Trace
                </Typography>
                <Box
                  paddingTop={2}
                  background="danger100"
                  padding={3}
                  hasRadius
                  style={{ overflow: 'auto', maxHeight: '300px' }}
                >
                  <pre
                    style={{
                      margin: 0,
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {job.stacktrace.join('\n')}
                  </pre>
                </Box>
              </Box>
            )}
          </Flex>
        </Modal.Body>

        <Modal.Footer>
          <Button onClick={onClose} variant="tertiary">
            Close
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
};

export default JobDetailsModal;
