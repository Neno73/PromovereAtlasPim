/**
 * Queue Manager API Client
 * Client for interacting with queue-manager API endpoints
 */

import { getFetchClient } from '@strapi/strapi/admin';

const { get, post, del } = getFetchClient();

export interface QueueStats {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused?: boolean;
  total: number;
}

export interface AllQueueStats {
  supplierSync: QueueStats;
  productFamily: QueueStats;
  imageUpload: QueueStats;
}

export interface WorkerStatus {
  isRunning: boolean;
  workerCount: number;
  workers: Array<{
    name: string;
    isRunning: boolean;
    isPaused: boolean;
  }>;
  concurrency: {
    'supplier-sync': number;
    'product-family': number;
    'image-upload': number;
  };
}

export interface Job {
  id: string;
  name: string;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  data: any;
  progress?: {
    step: string;
    percentage: number;
  };
  failedReason?: string;
  attemptsMade: number;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
}

export interface JobList {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface JobDetails extends Job {
  returnvalue?: any;
  stacktrace?: string[];
  opts?: {
    attempts: number;
    delay: number;
    timeout: number;
  };
}

/**
 * Get statistics for all queues
 */
export const getAllQueueStats = async (): Promise<AllQueueStats> => {
  const { data } = await get('/queue-manager/stats');
  return data;
};

/**
 * Get statistics for a specific queue
 */
export const getQueueStats = async (queueName: string): Promise<QueueStats> => {
  const { data } = await get(`/queue-manager/stats/${queueName}`);
  return data;
};

/**
 * Get worker status
 */
export const getWorkerStatus = async (): Promise<WorkerStatus> => {
  const { data } = await get('/queue-manager/workers');
  return data;
};

/**
 * List jobs from a queue
 */
export const listJobs = async (
  queueName: string,
  state: string = 'waiting',
  page: number = 1,
  pageSize: number = 25
): Promise<JobList> => {
  const { data } = await get(
    `/queue-manager/${queueName}/jobs?state=${state}&page=${page}&pageSize=${pageSize}`
  );
  return data;
};

/**
 * Get job details
 */
export const getJobDetails = async (
  queueName: string,
  jobId: string
): Promise<{ found: boolean; [key: string]: any }> => {
  const { data } = await get(`/queue-manager/${queueName}/jobs/${jobId}`);
  return data;
};

/**
 * Retry a failed job
 */
export const retryJob = async (
  queueName: string,
  jobId: string
): Promise<{ success: boolean; message: string }> => {
  const { data } = await post(`/queue-manager/${queueName}/jobs/${jobId}/retry`);
  return data;
};

/**
 * Retry all failed jobs in a queue
 */
export const retryFailedJobs = async (
  queueName: string,
  limit: number = 100
): Promise<{ success: boolean; retriedCount: number; failedCount: number; message: string }> => {
  const { data } = await post(`/queue-manager/${queueName}/retry-failed`, { limit });
  return data;
};

/**
 * Delete a job
 */
export const deleteJob = async (
  queueName: string,
  jobId: string
): Promise<{ success: boolean; message: string }> => {
  const { data } = await del(`/queue-manager/${queueName}/jobs/${jobId}`);
  return data;
};

/**
 * Pause a queue
 */
export const pauseQueue = async (queueName: string): Promise<{ success: boolean; message: string }> => {
  const { data } = await post(`/queue-manager/${queueName}/pause`);
  return data;
};

/**
 * Resume a queue
 */
export const resumeQueue = async (queueName: string): Promise<{ success: boolean; message: string }> => {
  const { data } = await post(`/queue-manager/${queueName}/resume`);
  return data;
};

/**
 * Clean old jobs from a queue
 */
export const cleanQueue = async (
  queueName: string,
  grace: number = 3600000,
  status: 'completed' | 'failed' = 'completed'
): Promise<{ success: boolean; deletedCount: number; message: string }> => {
  const { data } = await post(`/queue-manager/${queueName}/clean`, { grace, status });
  return data;
};

/**
 * Drain a queue (remove all jobs)
 */
export const drainQueue = async (queueName: string): Promise<{ success: boolean; message: string }> => {
  const { data } = await post(`/queue-manager/${queueName}/drain`);
  return data;
};
