/**
 * Queue Management Dashboard
 * Main page for monitoring and managing BullMQ queues
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Typography,
  Grid,
  Button,
  SingleSelect,
  SingleSelectOption,
} from '@strapi/design-system';
import { Page, Layouts, useNotification } from '@strapi/strapi/admin';
import QueueCard from './QueueCard';
import JobsTable from './JobsTable';
import JobDetailsModal from './JobDetailsModal';
import * as queueAPI from '../../api/queueManager';
import type { AllQueueStats, Job, JobDetails } from '../../api/queueManager';

const QueueManagement: React.FC = () => {
  const { toggleNotification } = useNotification();

  // State
  const [allStats, setAllStats] = useState<AllQueueStats | null>(null);
  const [selectedQueue, setSelectedQueue] = useState<string>('supplier-sync');
  const [selectedState, setSelectedState] = useState<string>('active');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobDetails | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch queue stats
  const fetchStats = async () => {
    try {
      const stats = await queueAPI.getAllQueueStats();
      setAllStats(stats);
    } catch (error) {
      console.error('Failed to fetch queue stats:', error);
      toggleNotification({
        type: 'danger',
        message: 'Failed to fetch queue statistics',
      });
    }
  };

  // Fetch jobs for selected queue and state
  const fetchJobs = async () => {
    if (!selectedQueue) return;

    setLoading(true);
    try {
      const jobList = await queueAPI.listJobs(selectedQueue, selectedState, 1, 25);
      setJobs(jobList.jobs);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      toggleNotification({
        type: 'danger',
        message: 'Failed to fetch jobs',
      });
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchJobs();
  }, []);

  // Auto-refresh stats every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchStats();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Auto-refresh jobs every 3 seconds (for active jobs)
  useEffect(() => {
    if (!autoRefresh || selectedState !== 'active') return;

    const interval = setInterval(() => {
      fetchJobs();
    }, 3000);

    return () => clearInterval(interval);
  }, [autoRefresh, selectedQueue, selectedState]);

  // Refresh jobs when queue or state changes
  useEffect(() => {
    fetchJobs();
  }, [selectedQueue, selectedState]);

  // Handle pause queue
  const handlePauseQueue = async (queueName: string) => {
    try {
      await queueAPI.pauseQueue(queueName);
      toggleNotification({
        type: 'success',
        message: `Queue ${queueName} paused`,
      });
      fetchStats();
    } catch (error) {
      toggleNotification({
        type: 'danger',
        message: 'Failed to pause queue',
      });
    }
  };

  // Handle resume queue
  const handleResumeQueue = async (queueName: string) => {
    try {
      await queueAPI.resumeQueue(queueName);
      toggleNotification({
        type: 'success',
        message: `Queue ${queueName} resumed`,
      });
      fetchStats();
    } catch (error) {
      toggleNotification({
        type: 'danger',
        message: 'Failed to resume queue',
      });
    }
  };

  // Handle clean queue
  const handleCleanQueue = async (queueName: string) => {
    if (!confirm('Clean completed jobs older than 1 hour?')) return;

    try {
      const result = await queueAPI.cleanQueue(queueName, 3600000, 'completed');
      toggleNotification({
        type: 'success',
        message: result.message,
      });
      fetchStats();
      fetchJobs();
    } catch (error) {
      toggleNotification({
        type: 'danger',
        message: 'Failed to clean queue',
      });
    }
  };

  // Handle retry failed jobs
  const handleRetryFailedJobs = async (queueName: string) => {
    try {
      const result = await queueAPI.retryFailedJobs(queueName, 100);
      toggleNotification({
        type: 'success',
        message: result.message,
      });
      fetchStats();
      fetchJobs();
    } catch (error) {
      toggleNotification({
        type: 'danger',
        message: 'Failed to retry failed jobs',
      });
    }
  };

  // Handle view job
  const handleViewJob = async (job: Job) => {
    try {
      const details = await queueAPI.getJobDetails(selectedQueue, job.id);
      if (details.found) {
        setSelectedJob(details as JobDetails);
        setIsModalOpen(true);
      }
    } catch (error) {
      toggleNotification({
        type: 'danger',
        message: 'Failed to fetch job details',
      });
    }
  };

  // Handle retry job
  const handleRetryJob = async (jobId: string) => {
    try {
      await queueAPI.retryJob(selectedQueue, jobId);
      toggleNotification({
        type: 'success',
        message: 'Job queued for retry',
      });
      fetchJobs();
      fetchStats();
    } catch (error) {
      toggleNotification({
        type: 'danger',
        message: 'Failed to retry job',
      });
    }
  };

  // Handle delete job
  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Delete this job?')) return;

    try {
      await queueAPI.deleteJob(selectedQueue, jobId);
      toggleNotification({
        type: 'success',
        message: 'Job deleted',
      });
      fetchJobs();
      fetchStats();
    } catch (error) {
      toggleNotification({
        type: 'danger',
        message: 'Failed to delete job',
      });
    }
  };

  if (!allStats) {
    return (
      <Page.Main>
        <Page.Title>Queue Management</Page.Title>
        <Typography>Loading...</Typography>
      </Page.Main>
    );
  }

  return (
    <Page.Main>
      <Page.Title>Queue Management</Page.Title>

      <Layouts.Content>
        {/* Header Actions */}
        <Box paddingBottom={4}>
          <Flex justifyContent="space-between" alignItems="center">
            <Typography variant="beta">Monitor and Manage Queues</Typography>
            <Flex gap={2}>
              <Button
                variant={autoRefresh ? 'success' : 'secondary'}
                size="S"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
              </Button>
              <Button
                variant="secondary"
                size="S"
                onClick={() => {
                  fetchStats();
                  fetchJobs();
                }}
              >
                Refresh Now
              </Button>
            </Flex>
          </Flex>
        </Box>

        {/* Queue Overview Cards */}
        <Box paddingBottom={6}>
          <Typography variant="delta" paddingBottom={4}>
            Queue Overview
          </Typography>
          <Grid.Root gap={4}>
            <Grid.Item col={4} s={12}>
              <QueueCard
                stats={allStats.supplierSync}
                onPause={() => handlePauseQueue('supplier-sync')}
                onResume={() => handleResumeQueue('supplier-sync')}
                onClean={() => handleCleanQueue('supplier-sync')}
                onRetryFailed={() => handleRetryFailedJobs('supplier-sync')}
              />
            </Grid.Item>
            <Grid.Item col={4} s={12}>
              <QueueCard
                stats={allStats.productFamily}
                onPause={() => handlePauseQueue('product-family')}
                onResume={() => handleResumeQueue('product-family')}
                onClean={() => handleCleanQueue('product-family')}
                onRetryFailed={() => handleRetryFailedJobs('product-family')}
              />
            </Grid.Item>
            <Grid.Item col={4} s={12}>
              <QueueCard
                stats={allStats.imageUpload}
                onPause={() => handlePauseQueue('image-upload')}
                onResume={() => handleResumeQueue('image-upload')}
                onClean={() => handleCleanQueue('image-upload')}
                onRetryFailed={() => handleRetryFailedJobs('image-upload')}
              />
            </Grid.Item>
          </Grid.Root>
        </Box>

        {/* Jobs Section */}
        <Box paddingBottom={4}>
          <Flex justifyContent="space-between" alignItems="center" paddingBottom={4}>
            <Typography variant="delta">Jobs</Typography>
            <Flex gap={2}>
              <SingleSelect
                label="Queue"
                value={selectedQueue}
                onChange={(value: string) => setSelectedQueue(value)}
                size="S"
              >
                <SingleSelectOption value="supplier-sync">Supplier Sync</SingleSelectOption>
                <SingleSelectOption value="product-family">Product Family</SingleSelectOption>
                <SingleSelectOption value="image-upload">Image Upload</SingleSelectOption>
              </SingleSelect>

              <SingleSelect
                label="State"
                value={selectedState}
                onChange={(value: string) => setSelectedState(value)}
                size="S"
              >
                <SingleSelectOption value="waiting">Waiting</SingleSelectOption>
                <SingleSelectOption value="active">Active</SingleSelectOption>
                <SingleSelectOption value="completed">Completed</SingleSelectOption>
                <SingleSelectOption value="failed">Failed</SingleSelectOption>
                <SingleSelectOption value="delayed">Delayed</SingleSelectOption>
              </SingleSelect>
            </Flex>
          </Flex>

          <JobsTable
            jobs={jobs}
            state={selectedState}
            onViewJob={handleViewJob}
            onRetryJob={handleRetryJob}
            onDeleteJob={handleDeleteJob}
            loading={loading}
          />
        </Box>
      </Layouts.Content>

      {/* Job Details Modal */}
      <JobDetailsModal
        job={selectedJob}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedJob(null);
        }}
      />
    </Page.Main>
  );
};

export default QueueManagement;
