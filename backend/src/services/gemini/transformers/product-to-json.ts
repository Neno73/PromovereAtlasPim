/**
 * Product to JSON Transformer for Gemini RAG
 *
 * Transforms a Strapi Product entity into a clean JSON object
 * suitable for uploading to Gemini's File Search (Corpus).
 *
 * Logic mirrors src/api/product/services/meilisearch.ts to ensure
 * consistency between the Search Engine (Meilisearch) and the RAG Engine (Gemini).
 */

export interface GeminiProductDocument {
  id: string;
  sku: string;
  a_number: string;
  name_en?: string;
  name_de?: string;
  name_fr?: string;
  name_es?: string;
  description_en?: string;
  description_de?: string;
  description_fr?: string;
  description_es?: string;
  brand?: string;
  supplier_name?: string;
  supplier_code?: string;
  category?: string;
  colors?: string[];
  sizes?: string[];
  price_min?: number;
  price_max?: number;
  currency?: string;
  main_image_url?: string;
  [key: string]: any;
}

export default {
  transform(product: any): GeminiProductDocument {
    // Extract multilingual fields from JSON
    const name = product.name || {};
    const description = product.description || {};
    const shortDescription = product.short_description || {};
    const material = product.material || {};

    // Use stored aggregation fields
    const colors: string[] = product.available_colors || [];
    const sizes: string[] = product.available_sizes || [];
    const hexColors: string[] = product.hex_colors || [];

    // Extract category info
    const categoryCodesList: string[] = [];
    let primaryCategory = '';
    if (product.categories && Array.isArray(product.categories)) {
      product.categories.forEach((cat: any) => {
        if (cat.code) {
          categoryCodesList.push(cat.code);
          if (!primaryCategory) {
            primaryCategory = typeof cat.name === 'object' ? cat.name.en || cat.code : cat.name;
          }
        }
      });
    }

    // Extract pricing
    const priceMin: number | undefined = product.price_min;
    const priceMax: number | undefined = product.price_max;

    // Extract currency
    let currency = 'EUR';
    if (product.price_tiers && Array.isArray(product.price_tiers)) {
      const sellingTier = product.price_tiers.find(
        (tier: any) => tier.price_type === 'selling' && tier.currency
      );
      if (sellingTier?.currency) {
        currency = sellingTier.currency;
      }
    }

    // Extract images
    let mainImageUrl: string | undefined;
    if (product.main_image) {
      if (typeof product.main_image === 'object') {
        mainImageUrl = product.main_image.url;
      } else if (typeof product.main_image === 'string') {
        mainImageUrl = product.main_image;
      }
    }

    // Build the document
    const document: GeminiProductDocument = {
      id: product.documentId,
      sku: product.sku,
      a_number: product.a_number,

      // Multilingual names
      name_en: name.en,
      name_de: name.de,
      name_fr: name.fr,
      name_es: name.es,

      // Multilingual descriptions
      description_en: description.en,
      description_de: description.de,
      description_fr: description.fr,
      description_es: description.es,

      // Short descriptions
      short_description_en: shortDescription.en,
      short_description_de: shortDescription.de,
      short_description_fr: shortDescription.fr,
      short_description_es: shortDescription.es,

      // Materials
      material_en: material.en,
      material_de: material.de,
      material_fr: material.fr,
      material_es: material.es,

      // Attributes
      brand: product.brand,
      supplier_name: product.supplier?.name || product.supplier_name || '',
      supplier_code: product.supplier?.code || '',
      category: primaryCategory,
      category_codes: categoryCodesList,
      
      colors,
      sizes,
      hex_colors: hexColors,

      price_min: priceMin,
      price_max: priceMax,
      currency,

      main_image_url: mainImageUrl,
      
      // Metadata
      updatedAt: product.updatedAt,
      promidata_hash: product.promidata_hash,
    };

    return document;
  }
};
