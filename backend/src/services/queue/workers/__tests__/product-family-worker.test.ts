/**
 * Product Family Worker Tests
 * Tests for the product family worker processor
 */

import { Job } from 'bullmq';

// Mock queue-config FIRST to prevent Redis connection
jest.mock('../../queue-config', () => ({
    productFamilyWorkerOptions: { connection: {} },
    imageUploadJobOptions: {},
    getRedisConnection: jest.fn(() => ({})),
}));

// Mock dependencies
jest.mock('../../../promidata/transformers/grouping');
jest.mock('../../../promidata/transformers/product-transformer');
jest.mock('../../../promidata/transformers/variant-transformer');
jest.mock('../../../promidata/sync/product-sync-service');
jest.mock('../../../promidata/sync/variant-sync-service');
jest.mock('../../../promidata/media/deduplication');
jest.mock('../../queue-service');

import { createProductFamilyWorker, ProductFamilyJobData } from '../product-family-worker';

import groupingService from '../../../promidata/transformers/grouping';
import productTransformer from '../../../promidata/transformers/product-transformer';
import variantTransformer from '../../../promidata/transformers/variant-transformer';
import productSyncService from '../../../promidata/sync/product-sync-service';
import variantSyncService from '../../../promidata/sync/variant-sync-service';
import deduplicationService from '../../../promidata/media/deduplication';
import queueService from '../../queue-service';

// Mock global Strapi
global.strapi = {
    log: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    },
    entityService: {
        create: jest.fn(),
        update: jest.fn(),
    },
} as any;

describe('Product Family Worker', () => {
    let worker: ReturnType<typeof createProductFamilyWorker>;
    let mockJob: Partial<Job<ProductFamilyJobData>>;

    beforeEach(() => {
        jest.clearAllMocks();

        mockJob = {
            id: 'test-job-456',
            data: {
                aNumber: 'TEST-A123',
                variants: [
                    { SKU: 'VAR-001', Color: 'Red', Size: 'M' },
                    { SKU: 'VAR-002', Color: 'Red', Size: 'L' },
                    { SKU: 'VAR-003', Color: 'Blue', Size: 'M' },
                ],
                supplierId: 1,
                supplierCode: 'TEST_SUPPLIER',
                productHash: 'test-hash-123',
            },
            updateProgress: jest.fn(),
        };
    });

    afterAll(() => {
        if (worker) {
            worker.close();
        }
    });

    describe('Successful Processing', () => {
        it('should process product family with variants', async () => {
            // Mock grouping by color
            const mockColorGroups = new Map([
                ['Red', { variants: [mockJob.data!.variants[0], mockJob.data!.variants[1]] }],
                ['Blue', { variants: [mockJob.data!.variants[2]] }],
            ]);
            (groupingService.groupByColor as jest.Mock).mockReturnValue(mockColorGroups);

            // Mock product transformer
            const mockProductData = {
                name: 'Test Product',
                a_number: 'TEST-A123',
                supplier: 1,
                product_hash: 'test-hash-123',
            };
            (productTransformer.transform as jest.Mock).mockReturnValue(mockProductData);

            // Mock product sync
            (productSyncService.createOrUpdate as jest.Mock).mockResolvedValue({
                productId: '123',
                isNew: true,
            });

            // Mock variant transformer
            (variantTransformer.transform as jest.Mock).mockImplementation((variantData, productId) => ({
                sku: variantData.SKU,
                product: productId,
                color: variantData.Color,
                size: variantData.Size,
            }));

            // Mock image URL extraction
            (variantTransformer.extractImageUrls as jest.Mock).mockReturnValue({
                primaryImage: 'http://example.com/image.jpg',
                galleryImages: [],
            });

            // Mock variant sync
            (variantSyncService.createOrUpdate as jest.Mock).mockImplementation((variantData) =>
                Promise.resolve({
                    variantId: `var-${variantData.sku}`,
                    documentId: `doc-${variantData.sku}`,
                    isNew: true,
                })
            );

            // Mock deduplication
            (deduplicationService.checkByFilename as jest.Mock).mockResolvedValue({
                exists: false,
            });

            // Mock Meilisearch queue
            (queueService.enqueueMeilisearchSync as jest.Mock).mockResolvedValue({ id: 'meilisearch-job' });

            // Create worker
            worker = createProductFamilyWorker();
            const processor = (worker as any).processFn;
            const result = await processor(mockJob);

            // Verify results
            expect(result).toMatchObject({
                aNumber: 'TEST-A123',
                productId: 123,
                variantsCreated: 3,
            });
            expect(mockJob.updateProgress).toHaveBeenCalledWith({ step: 'grouping_colors', percentage: 10 });
            expect(groupingService.groupByColor).toHaveBeenCalledWith(mockJob.data!.variants);
            expect(productSyncService.createOrUpdate).toHaveBeenCalledWith(mockProductData);
            expect(variantSyncService.createOrUpdate).toHaveBeenCalledTimes(3);
            expect(queueService.enqueueMeilisearchSync).toHaveBeenCalledTimes(3);
        });

        it('should handle image deduplication', async () => {
            const mockColorGroups = new Map([
                ['Red', { variants: [mockJob.data!.variants[0]] }],
            ]);
            (groupingService.groupByColor as jest.Mock).mockReturnValue(mockColorGroups);

            const mockProductData = { name: 'Test Product', supplier: 1 };
            (productTransformer.transform as jest.Mock).mockReturnValue(mockProductData);

            (productSyncService.createOrUpdate as jest.Mock).mockResolvedValue({
                productId: '123',
                isNew: true,
            });

            (variantTransformer.transform as jest.Mock).mockReturnValue({
                sku: 'VAR-001',
                product: 123,
            });

            (variantTransformer.extractImageUrls as jest.Mock).mockReturnValue({
                primaryImage: 'http://example.com/image.jpg',
                galleryImages: [],
            });

            (variantSyncService.createOrUpdate as jest.Mock).mockResolvedValue({
                variantId: 'var-001',
                documentId: 'doc-001',
                isNew: true,
            });

            // Mock deduplication - image exists
            (deduplicationService.checkByFilename as jest.Mock).mockResolvedValue({
                exists: true,
                mediaId: 999,
            });

            (variantSyncService.updateImages as jest.Mock).mockResolvedValue({});
            (queueService.enqueueMeilisearchSync as jest.Mock).mockResolvedValue({ id: 'meilisearch-job' });

            worker = createProductFamilyWorker();
            const processor = (worker as any).processFn;
            const result = await processor(mockJob);

            // Verify deduplication was used
            expect(variantSyncService.updateImages).toHaveBeenCalledWith(expect.any(Number), 999);
            expect(result.imagesEnqueued).toBe(0); // No new image upload jobs
        });
    });

    describe('Validation', () => {
        it('should throw error for missing aNumber', async () => {
            mockJob.data!.aNumber = '' as any;

            worker = createProductFamilyWorker();
            const processor = (worker as any).processFn;

            await expect(processor(mockJob)).rejects.toThrow('aNumber must be a non-empty string');
        });

        it('should throw error for empty variants array', async () => {
            mockJob.data!.variants = [];

            worker = createProductFamilyWorker();
            const processor = (worker as any).processFn;

            await expect(processor(mockJob)).rejects.toThrow('variants must be a non-empty array');
        });

        it('should throw error for invalid supplierId', async () => {
            mockJob.data!.supplierId = 'not-a-number' as any;

            worker = createProductFamilyWorker();
            const processor = (worker as any).processFn;

            await expect(processor(mockJob)).rejects.toThrow('supplierId must be a number');
        });

        it('should throw error for missing supplierCode', async () => {
            mockJob.data!.supplierCode = '' as any;

            worker = createProductFamilyWorker();
            const processor = (worker as any).processFn;

            await expect(processor(mockJob)).rejects.toThrow('supplierCode must be a non-empty string');
        });
    });

    describe('Error Handling', () => {
        it('should handle grouping service errors', async () => {
            (groupingService.groupByColor as jest.Mock).mockImplementation(() => {
                throw new Error('Grouping failed');
            });

            worker = createProductFamilyWorker();
            const processor = (worker as any).processFn;

            await expect(processor(mockJob)).rejects.toThrow('Grouping failed');
            expect(strapi.log.error).toHaveBeenCalled();
        });

        it('should handle product creation errors', async () => {
            const mockColorGroups = new Map([['Red', { variants: [mockJob.data!.variants[0]] }]]);
            (groupingService.groupByColor as jest.Mock).mockReturnValue(mockColorGroups);

            (productTransformer.transform as jest.Mock).mockReturnValue({});
            (productSyncService.createOrUpdate as jest.Mock).mockRejectedValue(
                new Error('Database error')
            );

            worker = createProductFamilyWorker();
            const processor = (worker as any).processFn;

            await expect(processor(mockJob)).rejects.toThrow('Database error');
        });

        it('should handle variant creation errors', async () => {
            const mockColorGroups = new Map([['Red', { variants: [mockJob.data!.variants[0]] }]]);
            (groupingService.groupByColor as jest.Mock).mockReturnValue(mockColorGroups);

            (productTransformer.transform as jest.Mock).mockReturnValue({});
            (productSyncService.createOrUpdate as jest.Mock).mockResolvedValue({ productId: '123', isNew: true });

            (variantTransformer.transform as jest.Mock).mockReturnValue({});
            (variantTransformer.extractImageUrls as jest.Mock).mockReturnValue({ primaryImage: null, galleryImages: [] });
            (variantSyncService.createOrUpdate as jest.Mock).mockRejectedValue(
                new Error('Variant creation failed')
            );

            worker = createProductFamilyWorker();
            const processor = (worker as any).processFn;

            await expect(processor(mockJob)).rejects.toThrow('Variant creation failed');
        });
    });
});
