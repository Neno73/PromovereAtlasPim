/**
 * Unit tests for product-transformer
 * Tests the transformation of Promidata raw data to Strapi Product entities
 */

import productTransformer from '../product-transformer';

describe('ProductTransformer', () => {

    describe('transform()', () => {
        it('should transform complete Promidata product with all fields', () => {
            const mockVariants = [
                {
                    SKU: 'VAR-001',
                    NonLanguageDependedProductDetails: {
                        Brand: 'TestBrand',
                        Category: 'Apparel',
                        SearchColor: 'Red',
                        DimensionsLength: '10',
                        DimensionsWidth: '5',
                        DimensionsHeight: '2',
                        Weight: '0.5',
                        CountryOfOrigin: 'China',
                        DeliveryTime: '5-7 days',
                        CustomsTariffNumber: '1234567890',
                        MustHaveImprint: true,
                    },
                    ProductDetails: {
                        en: {
                            Name: 'Test Product EN',
                            Description: 'English description',
                            ShortDescription: 'Short EN',
                            Image: { Url: 'https://example.com/image.jpg' },
                            ConfigurationFields: [
                                { ConfigurationName: 'Color', ConfigurationValue: 'Red' },
                                { ConfigurationName: 'Size', ConfigurationValue: 'M' },
                            ],
                        },
                        de: {
                            Name: 'Test Produkt DE',
                            Description: 'Deutsche Beschreibung',
                        },
                    },
                    PriceDetails: [
                        { PriceTaxIndicator: 'H' },
                    ],
                },
            ];

            const result = productTransformer.transform('A123', mockVariants, 1, 'hash123');

            expect(result).toMatchObject({
                sku: 'A123',
                a_number: 'A123',
                brand: 'TestBrand',
                category: 'Apparel',
                supplier: 1,
                promidata_hash: 'hash123',
                is_active: true,
                total_variants_count: 1,
            });

            expect(result.name).toEqual({
                en: 'Test Product EN',
                de: 'Test Produkt DE',
            });

            expect(result.description).toEqual({
                en: 'English description',
                de: 'Deutsche Beschreibung',
            });

            expect(result.dimensions).toEqual({
                length: 10,
                width: 5,
                height: 2,
                weight: 0.5,
            });

            expect(result.country_of_origin).toBe('China');
            expect(result.delivery_time).toBe('5-7 days');
            expect(result.customs_tariff_number).toBe('1234567890');
            expect(result.tax).toBe('H');
            expect(result.must_have_imprint).toBe(true);
        });

        it('should extract available colors from multiple variants', () => {
            const mockVariants = [
                {
                    SKU: 'VAR-001',
                    NonLanguageDependedProductDetails: { SearchColor: 'Red' },
                    ProductDetails: { en: { Name: 'Product' } },
                },
                {
                    SKU: 'VAR-002',
                    NonLanguageDependedProductDetails: { SearchColor: 'Blue' },
                    ProductDetails: { en: { Name: 'Product' } },
                },
                {
                    SKU: 'VAR-003',
                    NonLanguageDependedProductDetails: { SearchColor: 'Red' }, // Duplicate
                    ProductDetails: { en: { Name: 'Product' } },
                },
            ];

            const result = productTransformer.transform('A456', mockVariants, 1, 'hash456');

            expect(result.available_colors).toEqual(['Red', 'Blue']);
            expect(result.total_variants_count).toBe(3);
        });

        it('should extract available sizes from multiple variants', () => {
            const mockVariants = [
                {
                    SKU: 'VAR-001',
                    ProductDetails: {
                        en: {
                            Name: 'Product',
                            ConfigurationFields: [
                                { ConfigurationName: 'Size', ConfigurationValue: 'L' },
                            ],
                        },
                    },
                },
                {
                    SKU: 'VAR-002',
                    ProductDetails: {
                        en: {
                            Name: 'Product',
                            ConfigurationFields: [
                                { ConfigurationName: 'Size', ConfigurationValue: 'M' },
                            ],
                        },
                    },
                },
                {
                    SKU: 'VAR-003',
                    ProductDetails: {
                        en: {
                            Name: 'Product',
                            ConfigurationFields: [
                                { ConfigurationName: 'Size', ConfigurationValue: 'S' },
                            ],
                        },
                    },
                },
            ];

            const result = productTransformer.transform('A789', mockVariants, 1, 'hash789');

            expect(result.available_sizes).toEqual(['L', 'M', 'S']); // Sorted
        });

        it('should handle minimal variant data', () => {
            const mockVariants = [
                {
                    SKU: 'MIN-001',
                    ProductDetails: {
                        en: { Name: 'Minimal Product' },
                    },
                },
            ];

            const result = productTransformer.transform('AMIN', mockVariants, 1, 'hashmin');

            expect(result.sku).toBe('AMIN');
            expect(result.name).toEqual({ en: 'Minimal Product' });
            expect(result.available_colors).toEqual([]);
            expect(result.available_sizes).toEqual([]);
            expect(result.is_active).toBe(true);
        });

        it('should default to "Unnamed Product" when no name is provided', () => {
            const mockVariants = [
                {
                    SKU: 'NO-NAME',
                },
            ];

            const result = productTransformer.transform('ANAME', mockVariants, 1, 'hashname');

            expect(result.name).toEqual({ en: 'Unnamed Product' });
        });
    });

    describe('extractImageUrls()', () => {
        it('should extract image URLs from Promidata structure', () => {
            const mockData = {
                ProductDetails: {
                    en: {
                        Image: { Url: 'https://example.com/main.jpg' },
                        MediaGalleryImages: [
                            { Url: 'https://example.com/gallery1.jpg' },
                            { Url: 'https://example.com/gallery2.jpg' },
                        ],
                    },
                },
            };

            const result = productTransformer.extractImageUrls(mockData);

            expect(result.mainImage).toBe('https://example.com/main.jpg');
            expect(result.galleryImages).toEqual([
                'https://example.com/gallery1.jpg',
                'https://example.com/gallery2.jpg',
            ]);
        });

        it('should handle missing images gracefully', () => {
            const mockData = {
                ProductDetails: {
                    en: { Name: 'Product without images' },
                },
            };

            const result = productTransformer.extractImageUrls(mockData);

            expect(result.mainImage).toBeUndefined();
            expect(result.galleryImages).toEqual([]);
        });
    });
});
