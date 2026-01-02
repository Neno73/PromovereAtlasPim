/**
 * Integration Test: Full Sync Flow
 * Simulates the flow from product update to Gemini sync
 */

import { createGeminiSyncWorker } from '../../services/queue/workers/gemini-sync-worker';

// Mock queue-config
jest.mock('../../services/queue/queue-config', () => ({
    geminiSyncWorkerOptions: {
        connection: {},
        concurrency: 5,
    },
}));

// Mock BullMQ
jest.mock('bullmq', () => {
    return {
        Worker: jest.fn().mockImplementation((queueName, processor) => {
            return {
                on: jest.fn(),
                close: jest.fn(),
                processor,
            };
        }),
    };
});

// Mock gemini-service
jest.mock('../../services/gemini/gemini-service', () => ({
    addOrUpdateDocument: jest.fn(),
    deleteDocument: jest.fn(),
}));

import geminiService from '../../services/gemini/gemini-service';

// Mock Strapi global
global.strapi = {
    log: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
    service: jest.fn(),
} as any;

describe('Integration: Full Sync Flow', () => {
    let worker: any;
    let processor: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Initialize worker
        worker = createGeminiSyncWorker();
        // Get the processor function from the Worker constructor call
        // @ts-ignore
        processor = require('bullmq').Worker.mock.calls[0][1];
    });

    it('should process jobs and call Gemini service', async () => {
        // Setup mock implementation
        (geminiService.addOrUpdateDocument as jest.Mock).mockResolvedValue({ success: true });

        // 1. Enqueue a job
        // Note: The original test used a mockJob directly.
        // This new test implies a `queueService` which is not mocked here.
        // For the purpose of this edit, we'll simulate the job structure.
        const job = {
            data: {
                operation: 'update',
                documentId: 'doc-123',
            },
            updateProgress: jest.fn(),
        };

        // 2. Process the job manually using the worker processor
        const result = await processor(job);

        // 3. Verify result
        expect(result).toEqual({
            success: true,
            operation: 'update',
            documentId: 'doc-123',
        });

        // 4. Verify service call
        expect(geminiService.addOrUpdateDocument).toHaveBeenCalledWith('doc-123');
    });

    it('should handle failures gracefully', async () => {
        // Setup mock failure
        (geminiService.addOrUpdateDocument as jest.Mock).mockResolvedValue({
            success: false,
            error: 'API Error'
        });

        // Simulate a job
        const job = {
            data: {
                operation: 'update',
                documentId: 'doc-fail',
            },
            updateProgress: jest.fn(),
        };

        const result = await processor(job);

        expect(result).toEqual({
            success: false,
            operation: 'update',
            documentId: 'doc-fail',
            error: 'API Error',
        });

        expect(strapi.log.error).toHaveBeenCalled();
    });

    it('should process a successful sync job end-to-end', async () => {
        // 1. Setup Test Data
        const jobData = {
            operation: 'update',
            documentId: 'product-123',
        };

        const mockJob = {
            data: jobData,
            updateProgress: jest.fn(),
        };

        // 2. Setup Service Response
        (geminiService.addOrUpdateDocument as jest.Mock).mockResolvedValue({
            success: true,
            fileId: 'file-abc',
        });

        // 3. Execute Worker Processor
        const result = await processor(mockJob);

        // 4. Verify Results
        expect(mockJob.updateProgress).toHaveBeenCalledWith({ step: 'syncing', percentage: 50 });
        expect(geminiService.addOrUpdateDocument).toHaveBeenCalledWith('product-123');
        expect(mockJob.updateProgress).toHaveBeenCalledWith({ step: 'complete', percentage: 100 });

        expect(result).toEqual({
            success: true,
            operation: 'update',
            documentId: 'product-123',
        });

        expect(strapi.log.info).toHaveBeenCalledWith(
            expect.stringContaining('Gemini sync worker initialized')
        );
    });

    it('should handle "not in Meilisearch" scenario gracefully', async () => {
        // 1. Setup Test Data
        const jobData = {
            operation: 'add',
            documentId: 'product-missing',
        };

        const mockJob = {
            data: jobData,
            updateProgress: jest.fn(),
        };

        // 2. Setup Service Response (Failure)
        (geminiService.addOrUpdateDocument as jest.Mock).mockResolvedValue({
            success: false,
            error: 'Not found in Meilisearch',
        });

        // 3. Execute Worker Processor
        const result = await processor(mockJob);

        // 4. Verify Graceful Handling
        expect(geminiService.addOrUpdateDocument).toHaveBeenCalledWith('product-missing');

        // Should return success: true with skipped: true
        expect(result).toEqual({
            success: true,
            operation: 'add',
            documentId: 'product-missing',
            error: 'Not found in Meilisearch',
            skipped: true,
        });

        // Should log warning
        expect(strapi.log.warn).toHaveBeenCalledWith(
            expect.stringContaining('Skipped product-missing')
        );
    });
});
