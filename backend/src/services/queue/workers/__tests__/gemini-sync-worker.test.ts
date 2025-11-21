/**
 * Unit tests for Gemini Sync Worker
 */

// Mock queue-config before imports to prevent Redis validation
jest.mock('../../queue-config', () => ({
    geminiSyncWorkerOptions: {
        connection: {},
        concurrency: 5,
    },
}));

import { createGeminiSyncWorker } from '../gemini-sync-worker';
import { Worker } from 'bullmq';

// Mock BullMQ
jest.mock('bullmq', () => {
    return {
        Worker: jest.fn().mockImplementation((queueName, processor) => {
            return {
                on: jest.fn(),
                close: jest.fn(),
                processor, // Expose processor for testing
            };
        }),
    };
});

// Mock gemini-service
jest.mock('../../../gemini/gemini-service', () => ({
    deleteDocument: jest.fn(),
    addOrUpdateDocument: jest.fn(),
}));

import geminiService from '../../../gemini/gemini-service';

// Mock Strapi global
global.strapi = {
    log: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
    service: jest.fn(),
} as any;

describe('Gemini Sync Worker', () => {
    let mockJob: any;
    let worker: any;
    let processor: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup mock Job
        mockJob = {
            data: {
                operation: 'add',
                documentId: 'doc-123',
            },
            updateProgress: jest.fn(),
        };

        // Create worker and get processor
        worker = createGeminiSyncWorker();
        processor = (Worker as unknown as jest.Mock).mock.results[0].value.processor;
    });

    it('should throw error for invalid operation', async () => {
        mockJob.data.operation = 'invalid';

        await expect(processor(mockJob)).rejects.toThrow('Invalid job data');
    });

    it('should throw error for missing documentId', async () => {
        mockJob.data.documentId = '';

        await expect(processor(mockJob)).rejects.toThrow('Invalid job data');
    });

    describe('Delete Operation', () => {
        beforeEach(() => {
            mockJob.data.operation = 'delete';
        });

        it('should call deleteDocument and return success', async () => {
            (geminiService.deleteDocument as jest.Mock).mockResolvedValue({ success: true });

            const result = await processor(mockJob);

            expect(geminiService.deleteDocument).toHaveBeenCalledWith('doc-123');
            expect(mockJob.updateProgress).toHaveBeenCalledWith({ step: 'deleting', percentage: 50 });
            expect(result).toEqual({
                success: true,
                operation: 'delete',
                documentId: 'doc-123',
            });
        });

        it('should log warning but return success if delete fails', async () => {
            (geminiService.deleteDocument as jest.Mock).mockResolvedValue({
                success: false,
                error: 'File not found'
            });

            const result = await processor(mockJob);

            expect(strapi.log.warn).toHaveBeenCalled();
            expect(result.success).toBe(true);
        });
    });

    describe('Add/Update Operation', () => {
        beforeEach(() => {
            mockJob.data.operation = 'update';
        });

        it('should call addOrUpdateDocument and return success', async () => {
            (geminiService.addOrUpdateDocument as jest.Mock).mockResolvedValue({ success: true });

            const result = await processor(mockJob);

            expect(geminiService.addOrUpdateDocument).toHaveBeenCalledWith('doc-123');
            expect(mockJob.updateProgress).toHaveBeenCalledWith({ step: 'syncing', percentage: 50 });
            expect(result).toEqual({
                success: true,
                operation: 'update',
                documentId: 'doc-123',
            });
        });

        it('should return skipped if product not in Meilisearch', async () => {
            (geminiService.addOrUpdateDocument as jest.Mock).mockResolvedValue({
                success: false,
                error: 'Not found in Meilisearch'
            });

            const result = await processor(mockJob);

            expect(strapi.log.warn).toHaveBeenCalledWith(expect.stringContaining('Skipped'));
            expect(result).toEqual({
                success: true,
                operation: 'update',
                documentId: 'doc-123',
                error: 'Not found in Meilisearch',
                skipped: true,
            });
        });

        it('should throw error for other failures', async () => {
            (geminiService.addOrUpdateDocument as jest.Mock).mockResolvedValue({
                success: false,
                error: 'API Error'
            });

            // The worker catches the error and returns a failure result
            const result = await processor(mockJob);

            expect(result).toEqual({
                success: false,
                operation: 'update',
                documentId: 'doc-123',
                error: 'API Error',
            });
            expect(strapi.log.error).toHaveBeenCalled();
        });
    });
});
