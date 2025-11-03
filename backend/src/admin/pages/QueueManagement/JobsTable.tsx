/**
 * Jobs Table Component
 * Displays paginated list of jobs with actions
 */

import React from 'react';
import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Td,
  Th,
  Typography,
  Badge,
  IconButton,
  Flex,
  Button,
} from '@strapi/design-system';
import { Eye, Trash } from '@strapi/icons';
import type { Job } from '../../api/queueManager';

interface JobsTableProps {
  jobs: Job[];
  state: string;
  onViewJob: (job: Job) => void;
  onRetryJob: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
  loading?: boolean;
}

const JobsTable: React.FC<JobsTableProps> = ({
  jobs,
  state,
  onViewJob,
  onRetryJob,
  onDeleteJob,
  loading = false,
}) => {
  // Get badge variant based on job state
  const getStateBadgeVariant = (jobState: string) => {
    const variants: Record<string, any> = {
      waiting: 'secondary',
      active: 'success',
      completed: 'success',
      failed: 'danger',
      delayed: 'warning',
    };
    return variants[jobState] || 'neutral';
  };

  // Format timestamp to readable date
  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString();
  };

  // Format duration
  const formatDuration = (job: Job) => {
    if (!job.processedOn || !job.finishedOn) return '-';
    const duration = job.finishedOn - job.processedOn;
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${(duration / 60000).toFixed(1)}m`;
  };

  // Get shortened job ID
  const getShortJobId = (id: string) => {
    if (id.length <= 20) return id;
    return `${id.substring(0, 10)}...${id.substring(id.length - 6)}`;
  };

  if (jobs.length === 0) {
    return (
      <Box background="neutral0" padding={8} hasRadius>
        <Typography textAlign="center" textColor="neutral600">
          No {state} jobs found
        </Typography>
      </Box>
    );
  }

  return (
    <Box background="neutral0" hasRadius shadow="tableShadow">
      <Table colCount={6} rowCount={jobs.length}>
        <Thead>
          <Tr>
            <Th>
              <Typography variant="sigma">Job ID</Typography>
            </Th>
            <Th>
              <Typography variant="sigma">State</Typography>
            </Th>
            <Th>
              <Typography variant="sigma">Progress</Typography>
            </Th>
            <Th>
              <Typography variant="sigma">Created</Typography>
            </Th>
            {state === 'completed' && (
              <Th>
                <Typography variant="sigma">Duration</Typography>
              </Th>
            )}
            {state === 'failed' && (
              <Th>
                <Typography variant="sigma">Error</Typography>
              </Th>
            )}
            <Th>
              <Typography variant="sigma">Actions</Typography>
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {jobs.map((job) => (
            <Tr key={job.id}>
              {/* Job ID */}
              <Td>
                <Typography
                  variant="omega"
                  fontWeight="semiBold"
                  title={job.id}
                  style={{ fontFamily: 'monospace' }}
                >
                  {getShortJobId(job.id)}
                </Typography>
              </Td>

              {/* State */}
              <Td>
                <Badge variant={getStateBadgeVariant(job.state)}>
                  {job.state}
                </Badge>
              </Td>

              {/* Progress */}
              <Td>
                {job.progress ? (
                  <Flex direction="column" gap={1}>
                    <Typography variant="pi">
                      {job.progress.step.replace(/_/g, ' ')}
                    </Typography>
                    <Typography variant="pi" textColor="neutral600">
                      {job.progress.percentage}%
                    </Typography>
                  </Flex>
                ) : (
                  <Typography variant="pi" textColor="neutral600">
                    -
                  </Typography>
                )}
              </Td>

              {/* Created */}
              <Td>
                <Typography variant="pi">
                  {formatTimestamp(job.timestamp)}
                </Typography>
              </Td>

              {/* Duration (for completed) */}
              {state === 'completed' && (
                <Td>
                  <Typography variant="pi">{formatDuration(job)}</Typography>
                </Td>
              )}

              {/* Error (for failed) */}
              {state === 'failed' && (
                <Td>
                  <Typography
                    variant="pi"
                    textColor="danger600"
                    ellipsis
                    title={job.failedReason}
                  >
                    {job.failedReason || 'Unknown error'}
                  </Typography>
                </Td>
              )}

              {/* Actions */}
              <Td>
                <Flex gap={1}>
                  <IconButton
                    onClick={() => onViewJob(job)}
                    label="View details"
                  >
                    <Eye />
                  </IconButton>
                  {job.state === 'failed' && (
                    <Button
                      onClick={() => onRetryJob(job.id)}
                      size="S"
                      variant="secondary"
                    >
                      Retry
                    </Button>
                  )}
                  {(job.state === 'failed' || job.state === 'completed') && (
                    <IconButton
                      onClick={() => onDeleteJob(job.id)}
                      label="Delete job"
                    >
                      <Trash />
                    </IconButton>
                  )}
                </Flex>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
};

export default JobsTable;
