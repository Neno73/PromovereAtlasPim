/**
 * Unit tests for product-to-json transformer
 * Tests the transformation of Strapi Product entities to Gemini RAG documents
 */

import productToJson, { GeminiProductDocument } from '../product-to-json';

describe('product-to-json transformer', () => {
    describe('transform()', () => {
        it('should transform a complete product with all fields', () => {
            const mockProduct = {
                documentId: 'doc-123',
                sku: 'TEST-SKU-001',
                a_number: 'A123',
                name: {
                    en: 'Test Product',
                    de: 'Test Produkt',
                    fr: 'Produit Test',
                    es: 'Producto de Prueba',
                },
                description: {
                    en: 'English description',
                    de: 'Deutsche Beschreibung',
                    fr: 'Description française',
                    es: 'Descripción española',
                },
                short_description: {
                    en: 'Short EN',
                    de: 'Kurz DE',
                },
                material: {
                    en: 'Cotton',
                    de: 'Baumwolle',
                },
                brand: 'TestBrand',
                supplier: {
                    name: 'Test Supplier',
                    code: 'SUP001',
                },
                categories: [
                    { code: 'CAT1', name: { en: 'Category 1' } },
                    { code: 'CAT2', name: 'Category 2' },
                ],
                available_colors: ['Red', 'Blue'],
                available_sizes: ['S', 'M', 'L'],
                hex_colors: ['#FF0000', '#0000FF'],
                price_min: 10.5,
                price_max: 25.99,
                price_tiers: [
                    { price_type: 'selling', currency: 'USD' },
                ],
                main_image: {
                    url: 'https://example.com/image.jpg',
                },
                updatedAt: '2025-11-21T12:00:00Z',
                promidata_hash: 'hash123',
            };

            const result = productToJson.transform(mockProduct);

            expect(result).toMatchObject({
                id: 'doc-123',
                sku: 'TEST-SKU-001',
                a_number: 'A123',
                name_en: 'Test Product',
                name_de: 'Test Produkt',
                name_fr: 'Produit Test',
                name_es: 'Producto de Prueba',
                description_en: 'English description',
                description_de: 'Deutsche Beschreibung',
                brand: 'TestBrand',
                supplier_name: 'Test Supplier',
                supplier_code: 'SUP001',
                category: 'Category 1',
                category_codes: ['CAT1', 'CAT2'],
                colors: ['Red', 'Blue'],
                sizes: ['S', 'M', 'L'],
                hex_colors: ['#FF0000', '#0000FF'],
                price_min: 10.5,
                price_max: 25.99,
                currency: 'USD',
                main_image_url: 'https://example.com/image.jpg',
            });
        });

        it('should handle minimal product with only required fields', () => {
            const mockProduct = {
                documentId: 'doc-456',
                sku: 'MIN-SKU',
                a_number: 'A456',
            };

            const result = productToJson.transform(mockProduct);

            expect(result.id).toBe('doc-456');
            expect(result.sku).toBe('MIN-SKU');
            expect(result.a_number).toBe('A456');
            expect(result.colors).toEqual([]);
            expect(result.sizes).toEqual([]);
            expect(result.supplier_name).toBe('');
        });

        it('should default to EUR currency when no price_tiers', () => {
            const mockProduct = {
                documentId: 'doc-789',
                sku: 'EUR-SKU',
                a_number: 'A789',
            };

            const result = productToJson.transform(mockProduct);

            expect(result.currency).toBe('EUR');
        });

        it('should handle main_image as string', () => {
            const mockProduct = {
                documentId: 'doc-str',
                sku: 'STR-SKU',
                a_number: 'ASTR',
                main_image: 'https://example.com/direct-url.jpg',
            };

            const result = productToJson.transform(mockProduct);

            expect(result.main_image_url).toBe('https://example.com/direct-url.jpg');
        });

        it('should extract primary category from first category with code', () => {
            const mockProduct = {
                documentId: 'doc-cat',
                sku: 'CAT-SKU',
                a_number: 'ACAT',
                categories: [
                    { code: 'PRIMARY', name: { en: 'Primary Category' } },
                    { code: 'SECONDARY', name: { en: 'Secondary Category' } },
                ],
            };

            const result = productToJson.transform(mockProduct);

            expect(result.category).toBe('Primary Category');
            expect(result.category_codes).toEqual(['PRIMARY', 'SECONDARY']);
        });

        it('should handle empty or null multilingual fields', () => {
            const mockProduct = {
                documentId: 'doc-null',
                sku: 'NULL-SKU',
                a_number: 'ANULL',
                name: null,
                description: {},
            };

            const result = productToJson.transform(mockProduct);

            expect(result.name_en).toBeUndefined();
            expect(result.description_en).toBeUndefined();
        });
    });
});
