/**
 * Queue Card Component
 * Displays statistics and controls for a single queue
 */

import React from 'react';
import { Box, Flex, Typography, Button, Badge } from '@strapi/design-system';
import { Trash } from '@strapi/icons';
import type { QueueStats } from '../../api/queueManager';

interface QueueCardProps {
  stats: QueueStats;
  onPause: () => void;
  onResume: () => void;
  onClean: () => void;
  onRetryFailed: () => void;
}

const QueueCard: React.FC<QueueCardProps> = ({
  stats,
  onPause,
  onResume,
  onClean,
  onRetryFailed,
}) => {
  const isPaused = stats.paused || false;

  // Get queue display name
  const getQueueDisplayName = (queueName: string) => {
    const names: Record<string, string> = {
      'supplier-sync': 'Supplier Sync',
      'product-family': 'Product Family',
      'image-upload': 'Image Upload',
    };
    return names[queueName] || queueName;
  };

  // Get status color based on queue health
  const getStatusColor = () => {
    if (isPaused) return 'warning';
    if (stats.failed > 0) return 'danger';
    if (stats.active > 0) return 'success';
    return 'neutral';
  };

  return (
    <Box
      background="neutral0"
      borderColor="neutral200"
      hasRadius
      padding={4}
      shadow="tableShadow"
    >
      {/* Header */}
      <Flex direction="column" alignItems="flex-start" gap={2}>
        <Flex justifyContent="space-between" width="100%">
          <Typography variant="delta" fontWeight="bold">
            {getQueueDisplayName(stats.queueName)}
          </Typography>
          <Badge variant={getStatusColor()}>
            {isPaused ? 'Paused' : stats.active > 0 ? 'Active' : 'Idle'}
          </Badge>
        </Flex>

        {/* Stats Grid */}
        <Box width="100%" paddingTop={3} paddingBottom={3}>
          <Flex direction="column" gap={2}>
            <Flex justifyContent="space-between">
              <Typography variant="pi" textColor="neutral600">
                Waiting:
              </Typography>
              <Typography variant="pi" fontWeight="bold">
                {stats.waiting}
              </Typography>
            </Flex>

            <Flex justifyContent="space-between">
              <Typography variant="pi" textColor="neutral600">
                Active:
              </Typography>
              <Typography variant="pi" fontWeight="bold" textColor="success600">
                {stats.active}
              </Typography>
            </Flex>

            <Flex justifyContent="space-between">
              <Typography variant="pi" textColor="neutral600">
                Completed:
              </Typography>
              <Typography variant="pi" fontWeight="bold">
                {stats.completed}
              </Typography>
            </Flex>

            <Flex justifyContent="space-between">
              <Typography variant="pi" textColor="neutral600">
                Failed:
              </Typography>
              <Typography
                variant="pi"
                fontWeight="bold"
                textColor={stats.failed > 0 ? 'danger600' : 'neutral800'}
              >
                {stats.failed}
              </Typography>
            </Flex>

            {stats.delayed > 0 && (
              <Flex justifyContent="space-between">
                <Typography variant="pi" textColor="neutral600">
                  Delayed:
                </Typography>
                <Typography variant="pi" fontWeight="bold" textColor="warning600">
                  {stats.delayed}
                </Typography>
              </Flex>
            )}
          </Flex>
        </Box>

        {/* Action Buttons */}
        <Flex gap={2} width="100%" wrap="wrap">
          {!isPaused ? (
            <Button
              size="S"
              variant="secondary"
              onClick={onPause}
            >
              Pause
            </Button>
          ) : (
            <Button
              size="S"
              variant="success"
              onClick={onResume}
            >
              Resume
            </Button>
          )}

          {stats.failed > 0 && (
            <Button size="S" variant="tertiary" onClick={onRetryFailed}>
              Retry Failed ({stats.failed})
            </Button>
          )}

          {(stats.completed > 100 || stats.failed > 50) && (
            <Button
              size="S"
              variant="danger-light"
              startIcon={<Trash />}
              onClick={onClean}
            >
              Clean
            </Button>
          )}
        </Flex>
      </Flex>
    </Box>
  );
};

export default QueueCard;
