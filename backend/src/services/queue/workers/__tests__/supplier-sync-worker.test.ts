/**
 * Supplier Sync Worker Tests
 * Tests for the supplier sync worker processor
 */

import { Job } from 'bullmq';

// Mock queue-config FIRST to prevent Redis connection
jest.mock('../../queue-config', () => ({
    supplierSyncWorkerOptions: { connection: {} },
    productFamilyJobOptions: {},
    getRedisConnection: jest.fn(() => ({})),
}));

// Mock dependencies
jest.mock('../../../promidata/parsers/import-parser');
jest.mock('../../../promidata/parsers/product-parser');
jest.mock('../../../promidata/transformers/grouping');
jest.mock('../../../promidata/sync/product-sync-service');

import { createSupplierSyncWorker, SupplierSyncJobData } from '../supplier-sync-worker';

import importParser from '../../../promidata/parsers/import-parser';
import productParser from '../../../promidata/parsers/product-parser';
import groupingService from '../../../promidata/transformers/grouping';
import productSyncService from '../../../promidata/sync/product-sync-service';

// Mock global Strapi
global.strapi = {
    log: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    },
    entityService: {
        update: jest.fn(),
    },
} as any;

describe('Supplier Sync Worker', () => {
    let worker: ReturnType<typeof createSupplierSyncWorker>;
    let mockJob: Partial<Job<SupplierSyncJobData>>;

    beforeEach(() => {
        jest.clearAllMocks();

        mockJob = {
            id: 'test-job-123',
            data: {
                supplierId: 'supplier-doc-id-123',
                supplierCode: 'TEST_SUPPLIER',
                supplierNumericId: 1,
                manual: false,
            },
            updateProgress: jest.fn(),
        };
    });

    afterAll(() => {
        if (worker) {
            worker.close();
        }
    });

    describe('Successful Sync', () => {
        it('should process supplier sync with valid data', async () => {
            // Mock import parser
            (importParser.parseForSupplier as jest.Mock).mockResolvedValue([
                { sku: 'TEST-SKU-1', url: 'http://example.com/product1.json', hash: 'hash1' },
                { sku: 'TEST-SKU-2', url: 'http://example.com/product2.json', hash: 'hash2' },
            ]);

            // Mock product parser
            const mockParentProduct = {
                SKU: 'TEST-PARENT',
                ChildProducts: [
                    { SKU: 'TEST-SKU-1', ANumber: 'A123', Color: 'Red' },
                    { SKU: 'TEST-SKU-2', ANumber: 'A123', Color: 'Blue' },
                ],
            };
            (productParser.fetchAndParseBatch as jest.Mock).mockResolvedValue(
                new Map([['http://example.com/product1.json', mockParentProduct]])
            );
            (productParser.extractChildProducts as jest.Mock).mockReturnValue(
                mockParentProduct.ChildProducts
            );

            // Mock grouping service
            const mockGroupedData = new Map([
                ['TEST-PARENT', mockParentProduct.ChildProducts],
            ]);
            (groupingService.groupByANumber as jest.Mock).mockReturnValue(mockGroupedData);

            // Mock product sync service
            (productSyncService.filterProductsNeedingSync as jest.Mock).mockResolvedValue({
                needsSync: [{ aNumber: 'TEST-PARENT', hash: 'hash1' }],
                skipped: 0,
                efficiency: 0,
            });

            // Create worker (we won't actually start it, just test the processor function)
            worker = createSupplierSyncWorker();

            // Access the processor function
            const processor = (worker as any).processFn;
            const result = await processor(mockJob);

            // Verify results
            expect(result).toMatchObject({
                supplierCode: 'TEST_SUPPLIER',
                familiesEnqueued: 1,
            });
            expect(mockJob.updateProgress).toHaveBeenCalledWith({ step: 'parsing_import', percentage: 10 });
            expect(importParser.parseForSupplier).toHaveBeenCalledWith('TEST_SUPPLIER');
        });

        it('should skip sync if no products found', async () => {
            (importParser.parseForSupplier as jest.Mock).mockResolvedValue([]);

            worker = createSupplierSyncWorker();
            const processor = (worker as any).processFn;
            const result = await processor(mockJob);

            expect(result).toMatchObject({
                supplierCode: 'TEST_SUPPLIER',
                productsProcessed: 0,
                message: 'No products found',
            });
        });

        it('should skip sync if all products up-to-date', async () => {
            (importParser.parseForSupplier as jest.Mock).mockResolvedValue([
                { sku: 'TEST-SKU-1', url: 'http://example.com/product1.json', hash: 'hash1' },
            ]);

            const mockParentProduct = {
                SKU: 'TEST-PARENT',
                ChildProducts: [{ SKU: 'TEST-SKU-1', ANumber: 'A123' }],
            };
            (productParser.fetchAndParseBatch as jest.Mock).mockResolvedValue(
                new Map([['http://example.com/product1.json', mockParentProduct]])
            );
            (productParser.extractChildProducts as jest.Mock).mockReturnValue(
                mockParentProduct.ChildProducts
            );

            const mockGroupedData = new Map([['TEST-PARENT', mockParentProduct.ChildProducts]]);
            (groupingService.groupByANumber as jest.Mock).mockReturnValue(mockGroupedData);

            (productSyncService.filterProductsNeedingSync as jest.Mock).mockResolvedValue({
                needsSync: [],
                skipped: 1,
                efficiency: 100,
            });

            worker = createSupplierSyncWorker();
            const processor = (worker as any).processFn;
            const result = await processor(mockJob);

            expect(result).toMatchObject({
                supplierCode: 'TEST_SUPPLIER',
                productsProcessed: 0,
                skipped: 1,
                efficiency: 100,
            });
        });
    });

    describe('Validation', () => {
        it('should throw error for missing supplierId', async () => {
            mockJob.data!.supplierId = '' as any;

            worker = createSupplierSyncWorker();
            const processor = (worker as any).processFn;

            await expect(processor(mockJob)).rejects.toThrow('supplierId must be a non-empty string');
        });

        it('should throw error for invalid supplierNumericId', async () => {
            mockJob.data!.supplierNumericId = 'not-a-number' as any;

            worker = createSupplierSyncWorker();
            const processor = (worker as any).processFn;

            await expect(processor(mockJob)).rejects.toThrow('supplierNumericId must be a number');
        });

        it('should throw error for missing supplierCode', async () => {
            mockJob.data!.supplierCode = '' as any;

            worker = createSupplierSyncWorker();
            const processor = (worker as any).processFn;

            await expect(processor(mockJob)).rejects.toThrow('supplierCode must be a non-empty string');
        });
    });

    describe('Error Handling', () => {
        it('should handle import parser errors', async () => {
            (importParser.parseForSupplier as jest.Mock).mockRejectedValue(
                new Error('Failed to parse import file')
            );

            worker = createSupplierSyncWorker();
            const processor = (worker as any).processFn;

            await expect(processor(mockJob)).rejects.toThrow('Failed to parse import file');
            expect(strapi.log.error).toHaveBeenCalled();
        });

        it('should handle product parser errors', async () => {
            (importParser.parseForSupplier as jest.Mock).mockResolvedValue([
                { sku: 'TEST-SKU-1', url: 'http://example.com/product1.json', hash: 'hash1' },
            ]);
            (productParser.fetchAndParseBatch as jest.Mock).mockRejectedValue(
                new Error('Failed to fetch product data')
            );

            worker = createSupplierSyncWorker();
            const processor = (worker as any).processFn;

            await expect(processor(mockJob)).rejects.toThrow('Failed to fetch product data');
        });
    });
});
